import { apiClient } from './client';

export const aiApi = {
  parseText: (text: string) => apiClient.post('/ai/parse-text', { text }),
  parseScreenshot: (formData: FormData) =>
    apiClient.post('/ai/parse-screenshot', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  parseAudio: (formData: FormData) =>
    apiClient.post('/ai/parse-audio', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
