/**
 * Thin REST wrapper around Gmail API v1.
 *
 * The hot path is `getMessagesBatch` — fetching message bodies in bulk.
 * The original plan called this sequentially (N round-trips), which would
 * make a 400-message scan take ~80 seconds on Wi-Fi. We use bounded
 * concurrency (10 parallel `messages.get` calls) so a 400-message scan
 * completes in ~8 seconds.
 *
 * We don't use Gmail's `/batch` multipart endpoint — concurrency-bounded
 * Promise.all is simpler, plays nicer with rate limits, and is easier to
 * abort cleanly via AbortController.
 */

export interface GmailParsedMessage {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  receivedAt: string; // ISO
}

export class GmailApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'GmailApiError';
  }
}

const CONCURRENCY = 10;

export class GmailClient {
  constructor(
    private readonly getAccessToken: () => Promise<string>,
    private readonly signal?: AbortSignal,
  ) {}

  /**
   * Returns the email address of the currently authenticated user.
   * Used by `useGmailAuth.connect` to detect account switches without
   * needing the `userinfo.email` OAuth scope.
   */
  async getProfileEmail(): Promise<string | null> {
    const r = await this.authedFetch('https://gmail.googleapis.com/gmail/v1/users/me/profile');
    const data = await r.json();
    return typeof data?.emailAddress === 'string' ? data.emailAddress : null;
  }

  async listMessages(query: string, maxTotal = 500): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    while (ids.length < maxTotal) {
      this.checkAborted();
      const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
      url.searchParams.set('q', query);
      url.searchParams.set('maxResults', String(Math.min(100, maxTotal - ids.length)));
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const r = await this.authedFetch(url.toString());
      const data = await r.json();
      if (Array.isArray(data?.messages)) {
        ids.push(...data.messages.map((m: { id: string }) => m.id));
      }
      pageToken = data?.nextPageToken;
      if (!pageToken) break;
    }
    return ids;
  }

  /**
   * Fetch headers + body snippet for many messages with bounded concurrency.
   * Uses `format=metadata` first (cheap, headers only); only falls back to
   * full body if Gmail's own snippet is too short to AI-parse usefully.
   */
  async getMessagesBatch(
    ids: string[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<GmailParsedMessage[]> {
    const results: GmailParsedMessage[] = [];
    let completed = 0;

    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      this.checkAborted();
      const chunk = ids.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(
        chunk.map((id) => this.fetchMessage(id)),
      );
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value) results.push(r.value);
        // Failed messages are silently dropped — partial scan still useful.
      }
      completed += chunk.length;
      onProgress?.(completed, ids.length);
    }
    return results;
  }

  private async fetchMessage(id: string): Promise<GmailParsedMessage | null> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;
    const r = await this.authedFetch(url);
    const m = await r.json();
    const headers: Array<{ name: string; value: string }> = m?.payload?.headers ?? [];
    const findHeader = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

    const subject = findHeader('Subject');
    let snippet: string = typeof m?.snippet === 'string' ? m.snippet : '';

    // If Gmail's own snippet is too short, fetch full body for better AI context.
    if (snippet.length < 100) {
      const full = await this.fetchFullBody(id).catch(() => '');
      if (full && full.length > snippet.length) snippet = full;
    }

    const internalDate = parseInt(m?.internalDate ?? '0', 10);
    return {
      id: m?.id ?? id,
      subject: subject.slice(0, 500),
      from: findHeader('From'),
      snippet: snippet.slice(0, 2048),
      receivedAt: internalDate > 0 ? new Date(internalDate).toISOString() : new Date().toISOString(),
    };
  }

  private async fetchFullBody(id: string): Promise<string> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`;
    const r = await this.authedFetch(url);
    const m = await r.json();
    return this.extractBody(m?.payload, 0);
  }

  private extractBody(
    payload: { mimeType?: string; body?: { data?: string }; parts?: any[] } | undefined,
    depth: number,
  ): string {
    if (!payload || depth > 6) return '';
    if (payload.mimeType?.startsWith('text/plain') && payload.body?.data) {
      return this.b64UrlDecode(payload.body.data);
    }
    for (const p of payload.parts ?? []) {
      const out = this.extractBody(p, depth + 1);
      if (out) return out;
    }
    if (payload.body?.data) return this.b64UrlDecode(payload.body.data);
    return '';
  }

  private b64UrlDecode(s: string): string {
    try {
      const fixed = s.replace(/-/g, '+').replace(/_/g, '/');
      // RN-friendly: use globalThis.atob if available, else fallback.
      const decoded =
        typeof atob === 'function'
          ? atob(fixed)
          : Buffer.from(fixed, 'base64').toString('binary');
      // Best-effort UTF-8 reconstruction
      try {
        return decodeURIComponent(escape(decoded));
      } catch {
        return decoded;
      }
    } catch {
      return '';
    }
  }

  private checkAborted() {
    if (this.signal?.aborted) {
      throw new GmailApiError(0, 'aborted');
    }
  }

  private async authedFetch(url: string): Promise<Response> {
    this.checkAborted();
    const token = await this.getAccessToken();
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: this.signal,
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      // Strip access-token-shaped substrings from error messages so they
      // can't leak into Sentry breadcrumbs (review C5).
      const safeText = text.replace(/ya29\.[\w\-_.]+/g, '<redacted>');
      throw new GmailApiError(r.status, `Gmail API ${r.status}: ${safeText.slice(0, 200)}`);
    }
    return r;
  }
}
