import { apiClient } from './client';

export const aiApi = {
  wizard: (message: string, context?: Record<string, any>, locale?: string, history?: Array<{ role: 'user' | 'assistant'; content: string }>) =>
    apiClient.post('/ai/wizard', { message, context, locale, history }),
  lookupService: (query: string) => apiClient.post('/ai/lookup', { query }),
  parseText: (text: string) => apiClient.post('/ai/parse-text', { text }),
  searchService: (query: string) => apiClient.post('/ai/search', { query }),
  parseScreenshot: (formData: FormData) =>
    apiClient.post('/ai/parse-screenshot', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  parseAudio: (payload: FormData | { audioBase64: string; locale?: string }) =>
    payload instanceof FormData
      ? apiClient.post('/ai/parse-audio', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
      : apiClient.post('/ai/parse-audio', payload),
  parseVoice: (formData: FormData) =>
    apiClient.post('/ai/voice-to-subscription', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  // Bulk: parse multiple subscriptions from free text
  parseBulkText: (text: string, locale = 'en', currency?: string, country?: string) =>
    apiClient.post('/ai/parse-bulk', { text, locale, currency, country }),
  // Bulk: parse multiple subscriptions from voice
  parseBulkVoice: (payload: FormData | { audioBase64: string; locale?: string }) =>
    payload instanceof FormData
      ? apiClient.post('/ai/voice-bulk', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
      : apiClient.post('/ai/voice-bulk', payload),
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
