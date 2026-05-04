import { buildGmailQuery } from '../services/gmail/gmailQueryBuilder';

describe('buildGmailQuery', () => {
  it('builds shallow query from allowlist', () => {
    const q = buildGmailQuery({
      windowDays: 365,
      senders: [
        { domain: 'netflix.com', emailPattern: null },
        { domain: 'spotify.com', emailPattern: null },
        { domain: 'apple.com', emailPattern: 'no_reply@email.apple.com' },
      ],
    });
    expect(q).toContain('newer_than:365d');
    expect(q).toMatch(/from:\(/);
    expect(q).toContain('netflix.com');
    expect(q).toContain('spotify.com');
    expect(q).toContain('no_reply@email.apple.com');
  });

  it('returns just the time-window predicate when senders empty', () => {
    const q = buildGmailQuery({ windowDays: 30, senders: [] });
    expect(q).toBe('newer_than:30d');
  });

  it('preserves dashes and dots in domains', () => {
    const q = buildGmailQuery({
      windowDays: 30,
      senders: [{ domain: 'foo-bar.co.uk', emailPattern: null }],
    });
    expect(q).toContain('foo-bar.co.uk');
  });

  it('caps query length to safe limit when allowlist is huge', () => {
    const senders = Array.from({ length: 500 }, (_, i) => ({
      domain: `service-with-a-very-long-name-${i}.com`,
      emailPattern: null,
    }));
    const q = buildGmailQuery({ windowDays: 365, senders });
    expect(q.length).toBeLessThan(2000);
  });

  it('prefers emailPattern over domain when both present', () => {
    const q = buildGmailQuery({
      windowDays: 30,
      senders: [{ domain: 'apple.com', emailPattern: 'no_reply@email.apple.com' }],
    });
    expect(q).toContain('no_reply@email.apple.com');
    // Pattern is more specific, so domain should not be included separately
    expect(q.match(/apple\.com/g)?.length).toBe(1);
  });
});
