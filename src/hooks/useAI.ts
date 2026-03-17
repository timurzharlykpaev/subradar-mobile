import { useMutation } from '@tanstack/react-query';
import { aiApi } from '../api/ai';

export function useAILookupService() {
  return useMutation({
    mutationFn: (query: string) => aiApi.lookupService(query).then((r) => r.data),
  });
}

export function useAIParseText() {
  return useMutation({
    mutationFn: (text: string) => aiApi.parseText(text).then((r) => r.data),
  });
}

export function useVoiceToSubscription() {
  return useMutation({
    mutationFn: (formData: FormData) => aiApi.parseAudio(formData).then((r) => r.data),
  });
}

export function useScreenshotParse() {
  return useMutation({
    mutationFn: (formData: FormData) => aiApi.parseScreenshot(formData).then((r) => r.data),
  });
}
