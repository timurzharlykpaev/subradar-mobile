import { analytics } from '../services/analytics';

/**
 * Typed telemetry wrapper for the Gmail import funnel.
 *
 * All calls go through the existing `analytics` service (Amplitude under the
 * hood). Events are anonymized — we never attach the connected Gmail email,
 * message contents, or any sender domain that could identify the user. Only
 * counts, durations, and stage transitions.
 *
 * Privacy-by-design: backend has no knowledge of these events. They live
 * purely in our analytics SDK.
 */

type Source = 'add_sheet' | 'settings' | 'banner' | 'onboarding';
type ScanMode = 'shallow' | 'deep' | 'opportunistic';
type OauthCancelStage = 'webview' | 'consent_screen' | 'permission_denied';
type ScanFailureStage =
  | 'fetching_list'
  | 'fetching_bodies'
  | 'parsing'
  | 'auth_refresh'
  | 'unknown';

type AnyTrack = (event: string, props?: Record<string, unknown>) => void;
const track: AnyTrack = (event, props) => {
  // Cast through `any` because the canonical analytics type union doesn't
  // know about our new `gmail_import_*` events yet — adding them to the
  // shared catalog is a separate PR. Runtime behavior is identical.
  (analytics as unknown as { track: AnyTrack }).track(event, props);
};

export const emailImportTelemetry = {
  entryViewed: (source: Source) =>
    track('gmail_import_entry_viewed', { source }),

  paywallShown: (source: Source) =>
    track('gmail_import_paywall_shown', { source }),

  paywallUpgradeClick: () => track('gmail_import_paywall_upgrade_click'),

  consentViewed: () => track('gmail_import_consent_viewed'),
  consentAccepted: () => track('gmail_import_consent_accepted'),
  consentSkipped: () => track('gmail_import_consent_skipped'),

  oauthStarted: () => track('gmail_import_oauth_started'),
  oauthSuccess: () => track('gmail_import_oauth_success'),
  oauthCancelled: (stage: OauthCancelStage) =>
    track('gmail_import_oauth_cancelled', { stage }),
  oauthFailed: (errorCode: string) =>
    track('gmail_import_oauth_failed', { errorCode }),
  oauthNoRefreshToken: () => track('gmail_import_oauth_no_refresh_token'),

  scanStarted: (mode: ScanMode) =>
    track('gmail_import_scan_started', { mode }),
  scanCompleted: (props: { found: number; durationMs: number; mode: ScanMode }) =>
    track('gmail_import_scan_completed', props),
  scanFailed: (props: { stage: ScanFailureStage; errorCode: string }) =>
    track('gmail_import_scan_failed', props),

  reviewViewed: (props: { count: number; highConfidence: number; lowConfidence: number }) =>
    track('gmail_import_review_viewed', props),
  itemUnchecked: (confidence: number) =>
    track('gmail_import_item_unchecked', { confidenceBucket: bucket(confidence) }),
  itemEdited: () => track('gmail_import_item_edited'),

  saveClicked: (selectedCount: number) =>
    track('gmail_import_save_clicked', { selectedCount }),
  saveCompleted: (savedCount: number) =>
    track('gmail_import_save_completed', { savedCount }),
  savePartialFailure: (props: { savedCount: number; failedCount: number }) =>
    track('gmail_import_save_partial_failure', props),

  zeroResults: () => track('gmail_import_zero_results'),

  disconnected: (reason: 'user' | 'token_revoked' | 'multi_account_switch') =>
    track('gmail_import_disconnected', { reason }),

  proRequiredHit: () => track('gmail_import_pro_required_hit'),

  bannerShown: (count: number) =>
    track('gmail_import_banner_shown', { count }),
  bannerReviewClick: () => track('gmail_import_banner_review_click'),
  bannerDismissed: () => track('gmail_import_banner_dismissed'),
};

const bucket = (c: number): 'high' | 'medium' | 'low' => {
  if (c >= 0.85) return 'high';
  if (c >= 0.5) return 'medium';
  return 'low';
};
