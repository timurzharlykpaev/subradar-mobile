import { apiClient } from './client';

/**
 * Gmail bulk-scan integration.
 *
 * Flow:
 *   1. `connect()` → returns Google consent URL signed with state HMAC
 *      bound to the user. Mobile opens it in WebBrowser.
 *   2. User approves; Google redirects to /api/v1/gmail/callback which
 *      exchanges the code for tokens, persists encrypted refresh token,
 *      and bounces back to subradar:// deep link.
 *   3. App resumes, polls `status()` to confirm connection.
 *   4. User taps "Scan inbox" → `scan({ locale })` → up to 200 receipts
 *      from last 90d → AI candidates → review-and-import sheet.
 *   5. `disconnect()` revokes the grant on Google's side and clears
 *      stored tokens.
 *
 * Pro/Team gated server-side (RequireProGuard); Free users get HTTP 402
 * with code 'PRO_PLAN_REQUIRED' which the UI maps to the paywall.
 */
export interface GmailStatus {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  scopes: string[];
}

export interface GmailCandidatePlan {
  name: string;
  amount: number;
  currency: string;
  billingPeriod: string;
}

export interface GmailScanCandidate {
  sourceMessageId: string;
  name: string;
  amount: number;
  currency: string;
  billingPeriod:
    | 'MONTHLY'
    | 'YEARLY'
    | 'WEEKLY'
    | 'QUARTERLY'
    | 'LIFETIME'
    | 'ONE_TIME';
  category: string;
  status: 'ACTIVE' | 'TRIAL';
  nextPaymentDate?: string;
  trialEndDate?: string;
  confidence: number;
  isRecurring: boolean;
  isCancellation: boolean;
  isTrial: boolean;
  aggregatedFrom: string[];
  // ── Catalog-enriched (set by backend after AI parse) ─────────────────────
  // True when `amount` was lifted directly from the receipt body. False
  // means it was filled from the service catalog as a default — show a
  // subtle "verify amount" hint in the bulk-confirm row.
  amountFromEmail?: boolean;
  iconUrl?: string;
  serviceUrl?: string;
  cancelUrl?: string;
  // Available plans from the catalog so the user can switch tier in the
  // bulk-confirm row (e.g. ChatGPT Plus → ChatGPT Pro).
  availablePlans?: GmailCandidatePlan[];
}

export interface GmailScanResult {
  scanned: number;
  candidates: GmailScanCandidate[];
  durationMs: number;
}

export const gmailApi = {
  /** Returns { authUrl } — the Google consent screen URL to open. */
  connect: () => apiClient.get<{ authUrl: string }>('/gmail/connect'),

  /** Current connection state for the logged-in user. */
  status: () => apiClient.get<GmailStatus>('/gmail/status'),

  /** Revoke + clear stored tokens. Best-effort on Google's side. */
  disconnect: () =>
    apiClient.delete<{ revoked: boolean }>('/gmail/disconnect'),

  /** Pro/Team-gated bulk scan. Returns candidates for the review sheet. */
  scan: (locale?: string) =>
    apiClient.post<GmailScanResult>('/gmail/scan', { locale }),
};
