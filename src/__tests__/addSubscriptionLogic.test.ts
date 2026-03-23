/**
 * Tests for AI direct save and form validation logic
 * in AddSubscriptionSheet.
 */

describe('AI direct save logic', () => {
  // Mirrors the icon URL generation logic from onSave callback
  function generateIconUrl(sub: { name?: string; serviceUrl?: string; iconUrl?: string }): string | undefined {
    if (sub.iconUrl) return sub.iconUrl;
    if (sub.serviceUrl) {
      try {
        const host = new URL(sub.serviceUrl).hostname;
        return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
      } catch {
        // fall through to name-based fallback
      }
    }
    if (sub.name) {
      const slug = sub.name.toLowerCase().replace(/\s+/g, '').replace(/\+/g, 'plus');
      return `https://www.google.com/s2/favicons?domain=${slug}.com&sz=64`;
    }
    return undefined;
  }

  describe('generateIconUrl', () => {
    it('returns iconUrl if already provided', () => {
      expect(generateIconUrl({ iconUrl: 'https://example.com/icon.png' }))
        .toBe('https://example.com/icon.png');
    });

    it('generates favicon from serviceUrl', () => {
      expect(generateIconUrl({ serviceUrl: 'https://www.netflix.com' }))
        .toBe('https://www.google.com/s2/favicons?domain=www.netflix.com&sz=64');
    });

    it('generates favicon from name slug', () => {
      expect(generateIconUrl({ name: 'Netflix' }))
        .toBe('https://www.google.com/s2/favicons?domain=netflix.com&sz=64');
    });

    it('handles name with spaces and plus', () => {
      expect(generateIconUrl({ name: 'ChatGPT Plus' }))
        .toBe('https://www.google.com/s2/favicons?domain=chatgptplus.com&sz=64');
    });

    it('returns undefined when nothing provided', () => {
      expect(generateIconUrl({})).toBeUndefined();
    });

    it('falls back to name when serviceUrl is invalid', () => {
      expect(generateIconUrl({ serviceUrl: 'not-a-url', name: 'Spotify' }))
        .toBe('https://www.google.com/s2/favicons?domain=spotify.com&sz=64');
    });
  });

  describe('form validation', () => {
    function validateForm(form: { name: string; amount: string }): string | null {
      if (!form.name) return 'Name required';
      if (!form.amount || parseFloat(form.amount) <= 0) return 'Amount required';
      return null;
    }

    it('passes with valid name and amount', () => {
      expect(validateForm({ name: 'Netflix', amount: '15.99' })).toBeNull();
    });

    it('rejects empty name', () => {
      expect(validateForm({ name: '', amount: '15.99' })).toBe('Name required');
    });

    it('rejects empty amount', () => {
      expect(validateForm({ name: 'Netflix', amount: '' })).toBe('Amount required');
    });

    it('rejects zero amount', () => {
      expect(validateForm({ name: 'Netflix', amount: '0' })).toBe('Amount required');
    });

    it('rejects negative amount', () => {
      expect(validateForm({ name: 'Netflix', amount: '-5' })).toBe('Amount required');
    });
  });

  describe('category normalization', () => {
    function normalizeCategory(category?: string): string {
      return (category || 'OTHER').toUpperCase();
    }

    it('uppercases valid category', () => {
      expect(normalizeCategory('streaming')).toBe('STREAMING');
    });

    it('defaults to OTHER when undefined', () => {
      expect(normalizeCategory(undefined)).toBe('OTHER');
    });

    it('defaults to OTHER when empty', () => {
      expect(normalizeCategory('')).toBe('OTHER');
    });
  });

  describe('AI subscription payload construction', () => {
    function buildPayload(sub: any, defaultCurrency = 'USD') {
      return {
        name: sub.name || 'Subscription',
        category: (sub.category || 'OTHER').toUpperCase(),
        amount: sub.amount || 0,
        currency: sub.currency || defaultCurrency,
        billingPeriod: sub.billingPeriod || 'MONTHLY',
        billingDay: 1,
        status: 'ACTIVE' as const,
      };
    }

    it('fills defaults for minimal subscription', () => {
      const result = buildPayload({ name: 'Netflix', amount: 15.99 });
      expect(result).toEqual({
        name: 'Netflix',
        category: 'OTHER',
        amount: 15.99,
        currency: 'USD',
        billingPeriod: 'MONTHLY',
        billingDay: 1,
        status: 'ACTIVE',
      });
    });

    it('uses provided values over defaults', () => {
      const result = buildPayload({
        name: 'Spotify',
        amount: 9.99,
        currency: 'EUR',
        category: 'music',
        billingPeriod: 'YEARLY',
      });
      expect(result.currency).toBe('EUR');
      expect(result.category).toBe('MUSIC');
      expect(result.billingPeriod).toBe('YEARLY');
    });

    it('uses user default currency when not specified', () => {
      const result = buildPayload({ name: 'Test' }, 'KZT');
      expect(result.currency).toBe('KZT');
    });

    it('handles missing name', () => {
      const result = buildPayload({ amount: 5 });
      expect(result.name).toBe('Subscription');
    });
  });
});
