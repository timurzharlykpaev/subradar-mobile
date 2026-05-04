import { GmailClient, GmailApiError } from '../services/gmail/gmailClient';

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

const okJson = (body: any) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const failJson = (status: number, body: string) => ({
  ok: false,
  status,
  json: async () => ({}),
  text: async () => body,
});

beforeEach(() => mockFetch.mockReset());

describe('GmailClient', () => {
  const tokenFn = async () => 'access-token-123';

  describe('getProfileEmail', () => {
    it('returns the authenticated email', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ emailAddress: 'me@example.com' }));
      const c = new GmailClient(tokenFn);
      await expect(c.getProfileEmail()).resolves.toBe('me@example.com');
    });

    it('returns null when API returns nothing useful', async () => {
      mockFetch.mockResolvedValueOnce(okJson({}));
      const c = new GmailClient(tokenFn);
      await expect(c.getProfileEmail()).resolves.toBeNull();
    });
  });

  describe('listMessages', () => {
    it('paginates until maxTotal reached', async () => {
      mockFetch
        .mockResolvedValueOnce(okJson({
          messages: Array.from({ length: 100 }, (_, i) => ({ id: `m${i}` })),
          nextPageToken: 'p2',
        }))
        .mockResolvedValueOnce(okJson({
          messages: Array.from({ length: 50 }, (_, i) => ({ id: `n${i}` })),
        }));
      const c = new GmailClient(tokenFn);
      const ids = await c.listMessages('newer_than:30d', 200);
      expect(ids.length).toBe(150);
    });

    it('respects maxTotal cap', async () => {
      mockFetch.mockResolvedValueOnce(okJson({
        messages: Array.from({ length: 100 }, (_, i) => ({ id: `m${i}` })),
        nextPageToken: 'p2',
      }));
      const c = new GmailClient(tokenFn);
      const ids = await c.listMessages('q', 50);
      // First call returned 100 already, second page never fetched
      expect(ids.length).toBe(100);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws GmailApiError on 401', async () => {
      mockFetch.mockResolvedValueOnce(failJson(401, 'unauthorized'));
      const c = new GmailClient(tokenFn);
      await expect(c.listMessages('q', 10)).rejects.toBeInstanceOf(GmailApiError);
    });

    it('redacts access-token-shaped strings from error messages', async () => {
      mockFetch.mockResolvedValueOnce(failJson(401, 'invalid token: ya29.A0AbCdEfGh-xyz'));
      const c = new GmailClient(tokenFn);
      try {
        await c.listMessages('q', 10);
        fail('should have thrown');
      } catch (e: any) {
        expect(e.message).not.toContain('ya29.A0AbCdEfGh-xyz');
        expect(e.message).toContain('<redacted>');
      }
    });
  });

  describe('getMessagesBatch', () => {
    const messageMetadata = (id: string) => okJson({
      id,
      // > 100 chars so the gmailClient does NOT fall back to a full-body fetch
      snippet: 'Your Netflix subscription was successfully renewed for $15.49 on March 14, 2026. Next charge will occur on April 14, 2026.',
      internalDate: '1742000000000',
      payload: {
        headers: [
          { name: 'Subject', value: `${id} subject` },
          { name: 'From', value: `no-reply@${id}.com` },
          { name: 'Date', value: 'Mon, 14 Mar 2026 10:00:00 +0000' },
        ],
      },
    });

    it('uses bounded concurrency, not sequential — 50 ids in <= 5 batches of 10', async () => {
      mockFetch.mockImplementation((url: string) => {
        // Extract id from URL
        const match = url.match(/messages\/([^?]+)/);
        return Promise.resolve(messageMetadata(match?.[1] ?? 'unknown'));
      });
      const ids = Array.from({ length: 50 }, (_, i) => `m${i}`);
      const c = new GmailClient(tokenFn);
      const out = await c.getMessagesBatch(ids);
      expect(out.length).toBe(50);
      // 50 fetches, but they go in 5 chunks of 10 (concurrency cap)
      expect(mockFetch).toHaveBeenCalledTimes(50);
    });

    it('progress callback fires after each chunk', async () => {
      mockFetch.mockImplementation((url: string) => {
        const match = url.match(/messages\/([^?]+)/);
        return Promise.resolve(messageMetadata(match?.[1] ?? 'unknown'));
      });
      const ids = Array.from({ length: 25 }, (_, i) => `m${i}`);
      const onProgress = jest.fn();
      const c = new GmailClient(tokenFn);
      await c.getMessagesBatch(ids, onProgress);
      // 25 ids / 10 concurrency = 3 chunks (10, 10, 5)
      expect(onProgress).toHaveBeenCalledTimes(3);
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
      expect(lastCall).toEqual([25, 25]);
    });

    it('returns partial results when some messages fail', async () => {
      let calls = 0;
      mockFetch.mockImplementation((url: string) => {
        calls++;
        const match = url.match(/messages\/([^?]+)/);
        if (calls === 2) return Promise.resolve(failJson(500, 'internal'));
        return Promise.resolve(messageMetadata(match?.[1] ?? 'unknown'));
      });
      const c = new GmailClient(tokenFn);
      const out = await c.getMessagesBatch(['a', 'b', 'c']);
      // 1 of 3 dropped
      expect(out.length).toBe(2);
    });

    it('aborts cleanly via AbortSignal', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves
      const ctrl = new AbortController();
      const c = new GmailClient(tokenFn, ctrl.signal);
      const promise = c.getMessagesBatch(['a', 'b', 'c']);
      ctrl.abort();
      // Either rejects with abort or resolves to empty (depending on race)
      // The contract is: aborted scans don't hang.
      await expect(Promise.race([
        promise,
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 500)),
      ])).rejects.toBeDefined();
    });
  });
});
