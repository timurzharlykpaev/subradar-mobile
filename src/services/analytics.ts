/**
 * Analytics Service
 * Unified tracking layer over Amplitude (or any provider).
 * Drop-in: install @amplitude/analytics-react-native and call analytics.init() in _layout.tsx
 *
 * Usage:
 *   import { analytics } from '../services/analytics';
 *   analytics.track('paywall_viewed', { source: 'onboarding' });
 */

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

  // Auth
  | 'auth_method_selected'
  | 'auth_completed'

  // Activation
  | 'subscription_add_started'
  | 'subscription_added'
  | 'subscription_first_added'
  | 'subscription_deleted'
  | 'subscription_edited'

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
  | 'restore_tapped'
  | 'restore_completed'

  // Notifications
  | 'notification_permission_granted'
  | 'notification_permission_denied'
  | 'push_opened'

  // Engagement
  | 'analytics_viewed'
  | 'report_generated'

  // Team upsell
  | 'team_upsell_modal_shown'
  | 'team_upsell_modal_cta_tapped'
  | 'team_upsell_modal_dismissed'
  | 'team_upsell_dashboard_card_tapped'
  | 'team_upsell_analytics_card_tapped'
  | 'team_upsell_dupe_banner_tapped'
  | 'team_upsell_detail_hint_tapped'
  | 'team_upsell_ai_limit_tapped'

  // Churn / retention
  | 'subscription_cancelled'
  | 'cancellation_intercepted'
  | 'win_back_viewed'
  | 'win_back_resubscribed'

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
  | 'team_owner_expired_abandoned';

export type EventProperties = Record<string, string | number | boolean | null | undefined>;

// ─── Provider interface (swap Amplitude for any SDK) ─────────────────────────
interface AnalyticsProvider {
  init(apiKey: string): void;
  identify(userId: string, traits?: Record<string, any>): void;
  track(event: string, properties?: EventProperties): void;
  revenue(productId: string, price: number, revenue: number): void;
  reset(): void;
}

// ─── Console provider (dev / no SDK installed) ───────────────────────────────
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

// ─── Amplitude provider (uncomment after: npm i @amplitude/analytics-react-native) ──
// import * as Amplitude from '@amplitude/analytics-react-native';
// class AmplitudeProvider implements AnalyticsProvider {
//   init(apiKey: string) {
//     Amplitude.init(apiKey, {
//       flushIntervalMillis: 10_000,
//       flushQueueSize: 30,
//       trackingSessionEvents: true,
//     });
//   }
//   identify(userId: string, traits?: Record<string, any>) {
//     Amplitude.setUserId(userId);
//     if (traits) {
//       const ev = new Amplitude.Identify();
//       Object.entries(traits).forEach(([k, v]) => ev.set(k, v));
//       Amplitude.identify(ev);
//     }
//   }
//   track(event: string, properties?: EventProperties) {
//     Amplitude.track(event, properties);
//   }
//   revenue(productId: string, price: number, revenue: number) {
//     const ev = new Amplitude.Revenue()
//       .setProductId(productId)
//       .setPrice(price)
//       .setRevenue(revenue);
//     Amplitude.revenue(ev);
//   }
//   reset() { Amplitude.reset(); }
// }

// ─── Analytics service ────────────────────────────────────────────────────────
class AnalyticsService {
  private provider: AnalyticsProvider = new ConsoleProvider();
  private sessionId: string = Date.now().toString();
  private initialized = false;

  /** Call once in app/_layout.tsx after auth check */
  init(apiKey?: string) {
    if (this.initialized) return;
    // To switch to Amplitude: replace ConsoleProvider with AmplitudeProvider()
    // this.provider = new AmplitudeProvider();
    if (apiKey) this.provider.init(apiKey);
    this.initialized = true;
    this.track('app_open');
  }

  identify(userId: string, traits?: { plan?: string; currency?: string; language?: string }) {
    this.provider.identify(userId, traits);
  }

  track(event: AnalyticsEvent, properties?: EventProperties) {
    this.provider.track(event, {
      ...properties,
      session_id: this.sessionId,
      ts: Date.now(),
    });
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
}

export const analytics = new AnalyticsService();
