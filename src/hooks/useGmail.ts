import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gmailApi, GmailStatus, GmailScanResult } from '../api/gmail';
import i18n from '../i18n';

const currentLocale = () => (i18n.language || 'en').split('-')[0];

/** Connection status — refetches on focus so toggling Gmail on/off in
 *  another device's settings shows up promptly. */
export function useGmailStatus() {
  return useQuery<GmailStatus>({
    queryKey: ['gmail', 'status'],
    queryFn: () => gmailApi.status().then((r) => r.data),
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

/** Get the consent URL — fired on tap, NOT on screen mount. Each call
 *  produces a new signed state nonce so opening the URL twice in
 *  quick succession works fine (server uses single-use Redis lock on
 *  callback). */
export function useGmailConnect() {
  return useMutation({
    mutationFn: () => gmailApi.connect().then((r) => r.data.authUrl),
  });
}

export function useGmailDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => gmailApi.disconnect().then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gmail', 'status'] });
    },
  });
}

/** Pro/Team-gated bulk scan. Free users get a 402 PRO_PLAN_REQUIRED
 *  which the caller should map to the paywall route. */
export function useGmailScan() {
  return useMutation<GmailScanResult, Error>({
    mutationFn: () => gmailApi.scan(currentLocale()).then((r) => r.data),
  });
}
