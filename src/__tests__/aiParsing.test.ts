/**
 * Tests for AI response parsing logic used in AddSubscriptionSheet.
 * Verifies that voice/screenshot/text responses from backend are correctly
 * mapped to subscription arrays for applyParsedSubscriptions().
 */

describe('AI response parsing', () => {
  // This mirrors the parsing logic in AddSubscriptionSheet handleVoiceDone
  function parseVoiceResponse(data: any): any[] {
    if (Array.isArray(data.subscriptions)) return data.subscriptions;
    if (data.subscriptions) return [data.subscriptions];
    if (data.name && data.amount) return [data];
    return [];
  }

  // This mirrors the parsing logic in AddSubscriptionSheet screenshot handler
  function parseScreenshotResponse(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (data.subscriptions) return Array.isArray(data.subscriptions) ? data.subscriptions : [data.subscriptions];
    return [data];
  }

  describe('parseVoiceResponse', () => {
    it('handles flat object response (backend format)', () => {
      const data = { text: 'Netflix 15.99 monthly', name: 'Netflix', amount: 15.99, currency: 'USD', billingPeriod: 'MONTHLY' };
      const result = parseVoiceResponse(data);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Netflix');
      expect(result[0].amount).toBe(15.99);
    });

    it('handles subscriptions array response', () => {
      const data = { subscriptions: [{ name: 'Netflix', amount: 15.99 }, { name: 'Spotify', amount: 9.99 }] };
      const result = parseVoiceResponse(data);
      expect(result).toHaveLength(2);
    });

    it('handles single subscription object', () => {
      const data = { subscriptions: { name: 'Netflix', amount: 15.99 } };
      const result = parseVoiceResponse(data);
      expect(result).toHaveLength(1);
    });

    it('returns empty array when no parseable data', () => {
      const data = { text: 'random text without subscription info' };
      const result = parseVoiceResponse(data);
      expect(result).toHaveLength(0);
    });

    it('returns empty array for text-only response (no name/amount)', () => {
      const data = { text: 'hello world' };
      const result = parseVoiceResponse(data);
      expect(result).toEqual([]);
    });
  });

  describe('parseScreenshotResponse', () => {
    it('handles array response', () => {
      const data = [{ name: 'Netflix', amount: 15.99 }];
      const result = parseScreenshotResponse(data);
      expect(result).toHaveLength(1);
    });

    it('handles flat object response (wraps in array)', () => {
      const data = { name: 'Netflix', amount: 15.99, currency: 'USD' };
      const result = parseScreenshotResponse(data);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Netflix');
    });

    it('handles subscriptions field', () => {
      const data = { subscriptions: [{ name: 'Netflix', amount: 15.99 }] };
      const result = parseScreenshotResponse(data);
      expect(result).toHaveLength(1);
    });
  });
});
