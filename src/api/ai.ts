import { apiClient } from './client';

/**
 * Locale context attached to every AI call so backend prompts can respect the
 * user's currency, region and language. The backend also falls back to
 * `req.user.displayCurrency`/`region`/`locale`, but sending these explicitly
 * keeps the prompt deterministic and avoids server-side joins.
 */
export interface AILocaleCtx {
  locale?: string;
  currency?: string;
  country?: string;
}

/** Append non-empty locale fields to a FormData payload. */
function appendCtx(fd: FormData, ctx?: AILocaleCtx) {
  if (!ctx) return;
  if (ctx.locale) fd.append('locale', ctx.locale);
  if (ctx.currency) fd.append('currency', ctx.currency);
  if (ctx.country) fd.append('country', ctx.country);
}

export const aiApi = {
  wizard: (
    message: string,
    context?: Record<string, any>,
    locale?: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ) => apiClient.post('/ai/wizard', { message, context, locale, history }),

  lookupService: (query: string, opts?: AILocaleCtx) =>
    apiClient.post('/ai/lookup', {
      query,
      locale: opts?.locale,
      country: opts?.country,
      currency: opts?.currency,
    }),

  parseText: (text: string, opts?: AILocaleCtx) =>
    apiClient.post('/ai/parse-text', {
      text,
      locale: opts?.locale,
      currency: opts?.currency,
      country: opts?.country,
    }),

  searchService: (query: string, opts?: AILocaleCtx) =>
    apiClient.post('/ai/search', {
      query,
      locale: opts?.locale,
      country: opts?.country,
      currency: opts?.currency,
    }),

  parseScreenshot: (formData: FormData, ctx?: AILocaleCtx) => {
    appendCtx(formData, ctx);
    return apiClient.post('/ai/parse-screenshot', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  parseAudio: (
    payload: FormData | { audioBase64: string; locale?: string; currency?: string; country?: string },
  ) => {
    if (payload instanceof FormData) {
      return apiClient.post('/ai/parse-audio', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return apiClient.post('/ai/parse-audio', payload);
  },

  parseVoice: (formData: FormData, ctx?: AILocaleCtx) => {
    appendCtx(formData, ctx);
    return apiClient.post('/ai/voice-to-subscription', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Bulk: parse multiple subscriptions from free text
  parseBulkText: (text: string, locale = 'en', currency?: string, country?: string) =>
    apiClient.post('/ai/parse-bulk', { text, locale, currency, country }),

  // Bulk: parse multiple subscriptions from voice
  parseBulkVoice: (
    payload:
      | FormData
      | { audioBase64: string; locale?: string; currency?: string; country?: string },
  ) => {
    if (payload instanceof FormData) {
      return apiClient.post('/ai/voice-bulk', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return apiClient.post('/ai/voice-bulk', payload);
  },

  serviceCatalogLookup: async (serviceName: string) => {
    const { data } = await apiClient.get(`/ai/service-catalog/${encodeURIComponent(serviceName)}`);
    return data as {
      name: string;
      category: string;
      iconUrl?: string;
      serviceUrl?: string;
      cancelUrl?: string;
      plans?: { name: string; priceMonthly: number; currency: string }[];
    };
  },
};
