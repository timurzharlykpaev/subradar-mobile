import { useQuery } from '@tanstack/react-query';
import { emailImportApi } from '../api/emailImport';

export const EMAIL_IMPORT_STATUS_KEY = ['email-import-status'] as const;

export function useEmailImportStatus() {
  return useQuery({
    queryKey: EMAIL_IMPORT_STATUS_KEY,
    queryFn: () => emailImportApi.getStatus().then((r) => r.data),
    staleTime: 60_000,
  });
}
