import { apiClient } from './client';

export interface KnownSender {
  domain: string;
  emailPattern: string | null;
  serviceName: string;
  category: string;
  defaultCurrency: string | null;
}

export interface KnownSendersResponse {
  senders: KnownSender[];
  updatedAt: string;
}

export interface ParseInput {
  id: string;
  subject: string;
  snippet: string;
  from: string;
  receivedAt: string;
}

export type BillingPeriod =
  | 'MONTHLY'
  | 'YEARLY'
  | 'WEEKLY'
  | 'QUARTERLY'
  | 'LIFETIME'
  | 'ONE_TIME';

export interface Candidate {
  sourceMessageId: string;
  name: string;
  amount: number;
  currency: string;
  billingPeriod: BillingPeriod;
  category: string;
  status: 'ACTIVE' | 'TRIAL';
  nextPaymentDate?: string;
  trialEndDate?: string;
  iconUrl?: string;
  confidence: number;
  isRecurring: boolean;
  isCancellation: boolean;
  isTrial: boolean;
  aggregatedFrom: string[];
}

export interface ParseBulkResponse {
  candidates: Candidate[];
  scannedCount: number;
  droppedCount: number;
}

export interface EmailImportStatus {
  gmailConnected: boolean;
  lastScanAt: string | null;
  lastImportCount: number | null;
}

export const emailImportApi = {
  getKnownSenders: () =>
    apiClient.get<KnownSendersResponse>('/email-import/known-senders'),

  parseBulk: (data: { messages: ParseInput[]; locale: string }) =>
    apiClient.post<ParseBulkResponse>('/email-import/parse-bulk', data),

  getStatus: () => apiClient.get<EmailImportStatus>('/email-import/status'),

  disconnect: () => apiClient.post<{ ok: true }>('/email-import/disconnect'),

  recordImport: (count: number) =>
    apiClient.post<{ ok: true }>('/email-import/record-import', { count }),
};
