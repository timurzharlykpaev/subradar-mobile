import { apiClient } from './client';

export const aiApi = {
  lookupService: (query: string) => apiClient.post('/ai/lookup-service', { query }),
  parseText: (text: string) => apiClient.post('/ai/parse-text', { text }),
  parseScreenshot: (formData: FormData) =>
    apiClient.post('/ai/parse-screenshot', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  voice: (formData: FormData) =>
    apiClient.post('/ai/voice', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
