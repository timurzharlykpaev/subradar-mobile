/**
 * Build a Gmail search query (`q` param) for the subscription scan.
 *
 * Currently only supports the "shallow" mode that filters by an allowlist
 * of known billing senders. Deep scan (broad keyword search across the
 * whole mailbox) is intentionally deferred to R2 — see spec D5 / review M8.
 */

export interface SenderRef {
  domain: string;
  emailPattern: string | null;
}

export interface BuildQueryOpts {
  windowDays: number;
  senders: SenderRef[];
}

const MAX_QUERY_LEN = 1900;

/**
 * Builds `newer_than:Yd from:(d1 OR d2 OR ...)`.
 *
 * If the senders list is empty, returns just the time-window predicate
 * (no spam-restricting filter, but also no `from:()` clause that would
 * match nothing).
 *
 * Caps query length at ~1900 chars; senders that don't fit are dropped.
 * Backend allowlist is the source of truth and cycles fast enough that
 * dropping a few tail entries on first scan is acceptable.
 */
export function buildGmailQuery(opts: BuildQueryOpts): string {
  const window = `newer_than:${opts.windowDays}d`;
  if (opts.senders.length === 0) return window;

  const tokens: string[] = [];
  let used = window.length + ' from:('.length + 1;
  for (const s of opts.senders) {
    const tok = s.emailPattern ?? s.domain;
    const next = used + tok.length + 4;
    if (next > MAX_QUERY_LEN) break;
    tokens.push(tok);
    used = next;
  }
  if (tokens.length === 0) return window;
  return `${window} from:(${tokens.join(' OR ')})`;
}
