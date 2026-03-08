import { apiClient } from './client';

export const aiApi = {
  lookupService: (query: string) => apiClient.post('/ai/lookup', { query }),
  parseText: (text: string) => apiClient.post('/ai/parse-text', { text }),
  searchService: (query: string) => apiClient.post('/ai/search', { query }),
  parseScreenshot: (formData: FormData) =>
    apiClient.post('/ai/parse-screenshot', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  parseAudio: (formData: FormData) =>
    apiClient.post('/ai/parse-audio', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  parseVoice: (formData: FormData) =>
    apiClient.post('/ai/voice-to-subscription', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
