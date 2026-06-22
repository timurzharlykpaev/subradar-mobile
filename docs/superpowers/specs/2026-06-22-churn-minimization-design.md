# Churn Minimization — Design & Plan

**Date:** 2026-06-22
**Repos:** `subradar-backend` (NestJS), `subradar-mobile` (Expo RN)
**Goal:** Plug the retention holes that let promo-driven users leak out, before a LinkedIn/Reddit launch. Lead with server-side fixes that repair live App Store builds instantly.

## Context

SubRadar has two distinct "free" entry points, often conflated:
- **Internal trial** (`POST /billing/trial`) — server-granted 7-day Pro, **no card, never charges**. Downgrades to Free via daily cron.
- **Apple IAP** (RevenueCat → StoreKit) — real money, auto-renews.

The promo strategy is to funnel traffic into the **internal trial** (lowest friction, no card) and monetize via **win-back** after it ends. That only works if win-back actually fires and we can measure the funnel — both are currently broken.

## Findings (cross-repo audit)

| # | Finding | Verdict |
|---|---------|---------|
| 1 | Win-back banner requires `hadProBefore = !!user.downgradedAt`; `downgradedAt` is set on `RC_EXPIRATION` only, **not** on `TRIAL_EXPIRED`. Internal-trial users never see win-back. | 🔴 Critical hole |
| 2 | Backend soft-gate is fully built (`hiddenSubscriptionsCount`, `degradedMode`, `?gateByPlan`), but mobile never surfaces it — downgraded users get no messaging. | 🟠 Mobile gap |
| 3 | Free tier value (3 subs + basic analytics) is a fine anchor. | 🟢 OK, no change |
| 4 | Funnel events incomplete: `trial_started` defined but never called; `trial_ended` does not exist; `win_back_resubscribed` never fired. | 🟠 Blind funnel |
| 5 | Win-back payload is `{}` → mobile bucket logic always defaults to the middle bucket (`d3_7`). | 🟡 Polish |

## Design

### Backend (additive, no migration — `downgradedAt` column already exists; fixes old clients instantly)

1. **`downgradedAt` on trial expiry.** In `trial-checker.cron.ts#downgradeExpiredTrialsImpl`, set `downgradedAt: user.downgradedAt ?? now` alongside the existing `trialEndDate: null` update. Only set when null so a prior real downgrade timestamp is preserved. This lights up `win_back` for every internal-trial user — including those already on old App Store builds (they already render `win_back`).
2. **`daysSince` in `win_back` payload.** Add `downgradedAt: Date | null` to `BannerInput`; in the `win_back` branch compute `daysSince = floor((now - downgradedAt)/DAY)` and return it in the payload. Pass `user.downgradedAt` from `effective-access.service.ts`. Mobile already buckets on `payload.daysSince`.

### Mobile (additive, new builds only — backward-compatible)

3. **`trial_ended` event.** Add to `AnalyticsEvent` union. A small tracker mounted once in `app/_layout.tsx` persists "was trialing" (AsyncStorage); when billing `source` transitions `trial → free`, fire `trial_ended` once and clear the flag. Reliable for users who reopen the app (the win-back audience).
4. **`trial_started`.** Fire `analytics.trialStarted(plan)` in `useStartTrial().onSuccess` — single point covering every caller.
5. **`win_back_resubscribed`.** `WinBackBanner` navigates to `/paywall?prefill=pro-yearly&feature=winback`; on purchase success the paywall fires `win_back_resubscribed` when `feature === 'winback'`.
6. **Soft-gate banner.** New `DegradedModeBanner` shown on the subscriptions screen when `access.flags.degradedMode` is true: "Your data is safe — N subscriptions are locked. Upgrade to Pro to manage them." Routes to paywall. No per-card locking in this iteration (data stays fully visible; messaging only) — follow-up if needed.
7. **i18n.** New banner keys added to all 14 locales.

## Decisions (approved)
- `trial_ended` detected **client-side** via source transition (PostHog is client-side).
- Soft-gate **shows data + messages**, does not hide via `gateByPlan` (visible data = stickiness, lock = upgrade incentive).

## Backward-compatibility
- All backend changes additive; no DTO tightening, no enum removal, no migration. Old clients benefit (win-back lights up) without an update.
- Mobile changes are additive analytics + one new banner; old builds keep working unchanged.

## Out of scope
- Per-card lock UI for over-limit subs.
- Free-tier repricing/feature changes.
- Apple Offer Codes wiring (separate marketing task).

## Rollout
1. Backend → `dev` branch (auto-deploy api-dev), verify via diagnose workflow.
2. Backend → `main` (auto-deploy api-prod).
3. Mobile → `main` (no build; user ships via EAS manually).
4. Update `subradar-vault` Billing Flow note (separate commit).
