import { useMutation } from '@tanstack/react-query';
import { aiApi } from '../api/ai';

export function useAISearch() {
  return useMutation({
    mutationFn: (query: string) => aiApi.searchService(query).then((r) => r.data),
  });
}

export function useVoiceToSubscription() {
  return useMutation({
    mutationFn: (formData: FormData) => aiApi.parseVoice(formData).then((r) => r.data),
  });
}

export function useScreenshotParse() {
  return useMutation({
    mutationFn: (formData: FormData) => aiApi.parseScreenshot(formData).then((r) => r.data),
  });
}
