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
  /** True when amount was multiplied from a monthly catalog plan
   * (e.g. 12× monthly for a YEARLY receipt). UI surfaces this as
   * "approx" so the user knows to verify before saving. */
  amountIsApproximate?: boolean;
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
  /** True when Gmail had more matching messages than the backend
   * could read in one scan (page budget or MAX_MESSAGES cap).
   * Optional because old backends (≤ this branch) don't ship it. */
  truncated?: boolean;
  /** True when this response was served from a cached prior scan
   * (within the backend's 10-min cache window). Lets the UI swap
   * the loader for the review sheet immediately and show a
   * "Scan again" CTA next to the truncated banner. Old clients
   * ignore the field. */
  cached?: boolean;
  /** Funnel breakdown so the empty-state UI can explain WHY the
   * candidate list is empty. Optional because old backends don't
   * ship it. */
  summary?: {
    aiReturned: number;
    droppedNoise: number;
    droppedDup: number;
  };
}

export const gmailApi = {
  /** Returns { authUrl } — the Google consent screen URL to open. */
  connect: () => apiClient.get<{ authUrl: string }>('/gmail/connect'),

  /** Current connection state for the logged-in user. */
  status: () => apiClient.get<GmailStatus>('/gmail/status'),

  /** Revoke + clear stored tokens. Best-effort on Google's side. */
  disconnect: () =>
    apiClient.delete<{ revoked: boolean }>('/gmail/disconnect'),

  /**
   * Pro/Team-gated bulk scan. Returns candidates for the review sheet.
   * When `force` is true, bypasses the backend's 10-minute result cache
   * and runs a real scan — used by the "Scan again" CTA after the user
   * reviewed a cached result.
   *
   * NOTE: this is the SYNC endpoint, kept for backward compat with
   * older builds. New flows should use `startScan` + `getScanStatus`
   * so the scan survives a backgrounded app.
   */
  scan: (locale?: string, force = false) =>
    apiClient.post<GmailScanResult>('/gmail/scan', { locale, force }),

  /**
   * Async scan — returns immediately with a jobId. The scan runs
   * server-side regardless of whether the mobile keeps polling;
   * when it finishes the user gets a push notification with the
   * candidate count. The mobile either polls /status while the
   * screen is open or opens the screen via the push deep-link.
   *
   * On a fresh-cached result the response comes back as
   * `{ jobId, status: 'completed', cached: true }` — the mobile
   * client should then call /status once and render immediately
   * without ever showing the scan loader.
   */
  startScan: async (locale?: string, force = false) => {
    const { data } = await apiClient.post<{
      jobId: string;
      status: 'pending' | 'running' | 'completed';
      cached: boolean;
    }>('/gmail/scan/start', { locale, force });
    return data;
  },

  /**
   * Poll for a scan job's state. Polling cadence is the caller's
   * choice; backend rate-limits at 60 req/min/user, which is enough
   * for a 2s poll for the full job lifetime.
   */
  getScanStatus: async (jobId: string) => {
    const { data } = await apiClient.get<{
      jobId: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      result?: GmailScanResult;
      error?: { code?: string; message: string; statusCode?: number };
      startedAt: string;
      completedAt?: string;
    }>(`/gmail/scan/status/${encodeURIComponent(jobId)}`);
    return data;
  },
};
