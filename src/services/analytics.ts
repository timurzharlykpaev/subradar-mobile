/**
 * Analytics Service
 * Unified tracking layer over Amplitude (or any provider).
 * Initialized in app/_layout.tsx via analytics.init().
 *
 * Usage:
 *   import { analytics } from '../services/analytics';
 *   analytics.track('paywall_viewed', { source: 'onboarding' });
 *
 * Opt-out: controlled by useSettingsStore().analyticsOptOut — when true, all
 * track/identify/revenue calls are no-ops (not even buffered).
 */

import { useSettingsStore } from '../stores/settingsStore';

// ─── Event catalogue ──────────────────────────────────────────────────────────
export type AnalyticsEvent =
  // Session
  | 'app_open'
  | 'session_start'

  // Onboarding funnel
  | 'onboarding_started'
  | 'onboarding_step_viewed'
  | 'onboarding_step_completed'
  | 'onboarding_skipped'
  | 'onboarding_completed'
  | 'onboarding_money_hook_viewed'
  | 'onboarding_quick_add_tapped'
  | 'region_selected'

  // Auth
  | 'auth_method_selected'
  | 'auth_completed'

  // Activation
  | 'subscription_add_started'
  | 'subscription_added'
  | 'subscription_first_added'
  | 'subscription_deleted'
  | 'subscription_edited'
  | 'subscription_paused'
  | 'subscription_restored'

  // AI
  | 'ai_voice_started'
  | 'ai_voice_completed'
  | 'ai_screenshot_started'
  | 'ai_screenshot_completed'
  | 'ai_lookup_used'

  // Monetization funnel  ← critical path
  | 'paywall_viewed'
  | 'paywall_plan_selected'
  | 'paywall_period_toggled'
  | 'paywall_dismissed'
  | 'trial_cta_tapped'
  | 'trial_started'
  | 'purchase_initiated'
  | 'purchase_completed'
  | 'purchase_failed'
  | 'purchase_cancelled'
  | 'paywall_replayed_cancelled_sub'
  | 'paywall_replayed_different_plan'
  | 'restore_tapped'
  | 'restore_completed'

  // Notifications
  | 'notification_permission_granted'
  | 'notification_permission_denied'
  | 'push_opened'

  // Settings
  | 'currency_changed'
  | 'analytics_opt_out_toggled'

  // Engagement
  | 'analytics_viewed'
  | 'report_generated'
  | 'data_exported'

  // Team upsell
  | 'team_upsell_modal_shown'
  | 'team_upsell_modal_cta_tapped'
  | 'team_upsell_modal_dismissed'
  | 'team_upsell_dashboard_card_tapped'
  | 'team_upsell_analytics_card_tapped'
  | 'team_upsell_dupe_banner_tapped'
  | 'team_upsell_detail_hint_tapped'
  | 'team_upsell_ai_limit_tapped'

  // Pro gate
  | 'pro_gate_shown'
  | 'pro_gate_upgrade_tapped'
  | 'pro_gate_dismissed'

  // Churn / retention
  | 'subscription_cancelled'
  | 'cancellation_intercepted'
  | 'cancellation_retention_tapped'
  | 'cancellation_paused_tapped'
  | 'cancellation_reason_selected'
  | 'win_back_viewed'
  | 'win_back_resubscribed'
  | 'winback_banner_shown'
  | 'winback_banner_tapped'
  | 'winback_banner_dismissed'

  // Annual upgrade nudge
  | 'annual_nudge_shown'
  | 'annual_nudge_tapped'
  | 'annual_nudge_dismissed'

  // Family / ICP segmentation
  | 'icp_selected'
  | 'team_explainer_viewed'
  | 'team_explainer_cta_tapped'
  | 'team_explainer_dismissed'

  // Soft-gate + aha
  | 'soft_limit_warning_shown'
  | 'soft_limit_warning_tapped'
  | 'aha_trial_offer_shown'

  // Team / grace / double-pay
  | 'grace_started'
  | 'grace_ending_warning_shown'
  | 'grace_ended_downgraded'
  | 'grace_recovered_pro_purchased'
  | 'locked_sub_tapped'
  | 'locked_banner_tapped'
  | 'double_pay_banner_shown'
  | 'double_pay_cancel_tapped'
  | 'join_warn_shown'
  | 'join_warn_continued'
  | 'team_owner_expired_renewed'
  | 'team_owner_expired_abandoned'

  // Billing sync / restore / pending receipt (refactor)
  // Note: 'restore_completed' already declared above (legacy monetization funnel);
  // it is reused by restoreCompleted() with richer payload.
  | 'sync_retry_attempt'
  | 'sync_retry_succeeded'
  | 'sync_retry_exhausted'
  | 'pending_receipt_recovered'
  | 'pending_receipt_recovery_failed'
  | 'restore_initiated'
  | 'restore_failed'

  // Unified banner surface
  | 'banner_shown'
  | 'banner_action_tapped';

export type EventProperties = Record<string, string | number | boolean | null | undefined>;

// ─── Provider interface (swap Amplitude for any SDK) ─────────────────────────
interface AnalyticsProvider {
  init(apiKey: string): void;
  identify(userId: string, traits?: Record<string, any>): void;
  track(event: string, properties?: EventProperties): void;
  revenue(productId: string, price: number, revenue: number): void;
  reset(): void;
}

// ─── Console provider (dev / no SDK key configured) ──────────────────────────
class ConsoleProvider implements AnalyticsProvider {
  init(_apiKey: string) {}
  identify(userId: string, traits?: Record<string, any>) {
    if (__DEV__) console.log('[Analytics] identify', userId, traits);
  }
  track(event: string, properties?: EventProperties) {
    if (__DEV__) console.log(`[Analytics] ${event}`, properties ?? {});
  }
  revenue(productId: string, price: number, revenue: number) {
    if (__DEV__) console.log('[Analytics] revenue', { productId, price, revenue });
  }
  reset() {}
}

// ─── Amplitude provider ──────────────────────────────────────────────────────
// Lazy require so tests that mock this module don't need the native module.
class AmplitudeProvider implements AnalyticsProvider {
  private amp: any = null;

  private load() {
    if (this.amp) return this.amp;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.amp = require('@amplitude/analytics-react-native');
    } catch (e) {
      if (__DEV__) console.warn('[Analytics] Amplitude SDK not available, falling back to console', e);
    }
    return this.amp;
  }

  init(apiKey: string) {
    const amp = this.load();
    if (!amp) return;
    amp.init(apiKey, undefined, {
      defaultTracking: { sessions: true, appLifecycles: true },
      flushIntervalMillis: 10_000,
      flushQueueSize: 30,
    });
  }

  identify(userId: string, traits?: Record<string, any>) {
    const amp = this.load();
    if (!amp) return;
    amp.setUserId(userId);
    if (traits && amp.Identify) {
      const ev = new amp.Identify();
      Object.entries(traits).forEach(([k, v]) => {
        if (v != null) ev.set(k, v as any);
      });
      amp.identify(ev);
    }
  }

  track(event: string, properties?: EventProperties) {
    const amp = this.load();
    if (!amp) return;
    amp.track(event, properties);
  }

  revenue(productId: string, price: number, revenue: number) {
    const amp = this.load();
    if (!amp || !amp.Revenue) return;
    const ev = new amp.Revenue()
      .setProductId(productId)
      .setPrice(price)
      .setRevenue(revenue);
    amp.revenue(ev);
  }

  reset() {
    const amp = this.load();
    if (!amp) return;
    amp.reset();
  }
}

const AMPLITUDE_KEY = process.env.EXPO_PUBLIC_AMPLITUDE_KEY;

// ─── Analytics service ────────────────────────────────────────────────────────
class AnalyticsService {
  private provider: AnalyticsProvider = new ConsoleProvider();
  private sessionId: string = Date.now().toString();
  private initialized = false;

  private isOptedOut(): boolean {
    try {
      return useSettingsStore.getState().analyticsOptOut === true;
    } catch {
      return false;
    }
  }

  /** Call once in app/_layout.tsx. */
  init() {
    if (this.initialized) return;
    // Use Amplitude in prod when a key is present; Console otherwise.
    const keyIsReal = AMPLITUDE_KEY && !AMPLITUDE_KEY.startsWith('__TODO_');
    if (keyIsReal && !__DEV__) {
      this.provider = new AmplitudeProvider();
      this.provider.init(AMPLITUDE_KEY as string);
    }
    this.initialized = true;
    this.track('app_open');
  }

  identify(userId: string, traits?: { plan?: string; currency?: string; language?: string }) {
    if (this.isOptedOut()) return;
    this.provider.identify(userId, traits);
  }

  track(event: AnalyticsEvent, properties?: EventProperties) {
    if (this.isOptedOut()) return;
    this.provider.track(event, {
      ...properties,
      session_id: this.sessionId,
      ts: Date.now(),
    });
  }

  /** Reset session id — call on app resume from background. */
  newSession() {
    this.sessionId = Date.now().toString();
  }

  reset() {
    this.provider.reset();
    this.sessionId = Date.now().toString();
  }

  // ─── Convenience helpers (avoids spread boilerplate at call sites) ──────────

  paywallViewed(source: 'onboarding' | 'feature_gate' | 'settings' | 'direct' | 'upsell') {
    this.track('paywall_viewed', { source });
  }

  paywallDismissed(afterSeconds: number, selectedPlan: string, period: string) {
    this.track('paywall_dismissed', {
      after_seconds: afterSeconds,
      selected_plan: selectedPlan,
      period,
    });
  }

  purchaseCompleted(plan: string, period: string, price: number) {
    if (this.isOptedOut()) return;
    const revenue = parseFloat((price * 0.85).toFixed(2)); // after App Store 15% fee
    this.track('purchase_completed', { plan, period, price, revenue });
    this.provider.revenue(`io.subradar.mobile.${plan}.${period}`, price, revenue);
  }

  purchaseFailed(plan: string, error: string) {
    this.track('purchase_failed', { plan, error: error.slice(0, 100) });
  }

  trialStarted(plan: string) {
    this.track('trial_started', { plan });
  }

  subscriptionAdded(
    category: string,
    amount: number,
    currency: string,
    billingCycle: string,
    isFirst: boolean,
    source: 'manual' | 'voice' | 'screenshot' | 'ai_lookup' | 'quick_add' = 'manual',
  ) {
    this.track('subscription_added', { category, amount, currency, billing_cycle: billingCycle, source });
    if (isFirst) {
      this.track('subscription_first_added', { category, amount, source });
    }
  }

  onboardingStep(step: number, stepName: string, completed: boolean) {
    this.track(completed ? 'onboarding_step_completed' : 'onboarding_step_viewed', {
      step,
      step_name: stepName,
    });
  }

  authCompleted(method: 'google' | 'apple' | 'email', isNewUser: boolean) {
    this.track('auth_completed', { method, is_new_user: isNewUser });
  }

  notificationPermission(granted: boolean) {
    this.track(granted ? 'notification_permission_granted' : 'notification_permission_denied');
  }

  // ─── Billing sync / restore / pending receipt ───────────────────────────────

  syncRetryAttempt(attempt: number, productId: string) {
    this.track('sync_retry_attempt', { attempt, product_id: productId });
  }

  syncRetrySucceeded(attempt: number, productId: string) {
    this.track('sync_retry_succeeded', { attempt, product_id: productId });
  }

  syncRetryExhausted(productId: string, lastError?: string) {
    this.track('sync_retry_exhausted', {
      product_id: productId,
      last_error: lastError?.slice(0, 200),
    });
  }

  pendingReceiptRecovered(productId: string) {
    this.track('pending_receipt_recovered', { product_id: productId });
  }

  pendingReceiptRecoveryFailed(productId: string, error?: string) {
    this.track('pending_receipt_recovery_failed', {
      product_id: productId,
      error: error?.slice(0, 200),
    });
  }

  restoreInitiated(origin: 'paywall' | 'settings') {
    this.track('restore_initiated', { origin });
  }

  restoreCompleted(origin: 'paywall' | 'settings', success: boolean, productId?: string) {
    this.track('restore_completed', {
      origin,
      success,
      product_id: productId ?? null,
    });
  }

  restoreFailed(origin: 'paywall' | 'settings', error?: string) {
    this.track('restore_failed', { origin, error: error?.slice(0, 200) });
  }

  // ─── Unified banner surface ─────────────────────────────────────────────────

  bannerShown(
    priority:
      | 'billing_issue'
      | 'grace'
      | 'expiration'
      | 'double_pay'
      | 'annual_upgrade'
      | 'win_back',
    payload?: EventProperties,
  ) {
    this.track('banner_shown', { priority, ...(payload ?? {}) });
  }

  bannerActionTapped(
    priority:
      | 'billing_issue'
      | 'grace'
      | 'expiration'
      | 'double_pay'
      | 'annual_upgrade'
      | 'win_back',
    action: string,
    payload?: EventProperties,
  ) {
    this.track('banner_action_tapped', { priority, action, ...(payload ?? {}) });
  }
}

export const analytics = new AnalyticsService();
