# Conversion Boost — 4 Sub-Projects Spec

**Date:** 2026-04-16
**Status:** Approved for autonomous execution
**Scope:** iOS mobile app conversion improvements — paywall, retention, annual upsell, family-plan clarity, free-limit soft-gate.

## Why now

Current conversion funnel has several high-impact, low-effort leaks:
- Cancellation flow lies to users ("50% off" promise not honored on subsequent paywall)
- `subscription-plan.tsx` calls native `Alert.alert` instead of `CancellationInterceptModal` — zero retention friction
- Free-plan limit is `3` in code but documented as `5` in `BILLING_RULES.md` — shifts trust and user expectations
- Zero proactive monthly→yearly nudge — direct LTV leak (annual LTV ~1.5x monthly)
- Team/Family plan value not explained in context where users decide — conversion ceiling
- `WinBackBanner` dismisses permanently in one click — single shot at resurrection
- Existing `TrialOfferModal` is generic — no loss-aversion framing, no personalized numbers

All four sub-projects share one goal: increase install→paid conversion AND paid→annual mix WITHOUT touching payment infrastructure (RevenueCat / Apple IAP / backend billing logic).

---

## Sub-Project A — Cancellation Hardening + Retention Funnel

### Problems

1. `src/components/CancellationInterceptModal.tsx:98` promises "Special offer: 50% off" but routes to regular `/paywall` without discount.
2. `app/subscription-plan.tsx:60-69` cancels via raw `Alert.alert` — `CancellationInterceptModal` is not invoked at all for Pro→Free cancel path (only trial cancel uses it, and even that is unclear).
3. No pause-instead-of-cancel option (Apple/RC support).
4. No reason-selector — no data on WHY users churn.
5. `WinBackBanner` dismisses permanently via single AsyncStorage flag — no D1/D7/D30 escalation.

### Changes

#### A1 — Honest CancellationInterceptModal copy

Remove fake "50% off" text. Replace with factual retention offer based on context:

- **If monthly subscriber:** "Switch to yearly — save $X/year" (uses real yearly price)
- **If yearly subscriber:** "Pause for 1 month" (via `Linking.openURL('itms-apps://apps.apple.com/account/subscriptions')`)
- **If trialing:** "Keep your data organized — finish trial first"

Label on primary CTA becomes dynamic, no longer says "50% off".

#### A2 — Wire intercept modal into subscription-plan.tsx

Replace the raw `Alert.alert` in `handleCancel` with `CancellationInterceptModal`. Pass `onConfirmCancel` → existing `cancelMutation.mutate()`.

#### A3 — Pause option

Add a "Pause subscription" secondary action in intercept modal. On tap, open Apple's native Manage Subscriptions page via `Linking.openURL('https://apps.apple.com/account/subscriptions')`. Track `cancellation_paused_tapped`.

Apple handles pause natively — we just deep-link. No backend changes.

#### A4 — Reason selector

Add 2-step flow inside `CancellationInterceptModal`:
- **Step 1** — current "here's what you lose" + retention offer
- **Step 2** (after "Cancel anyway") — reason grid: too expensive / not using / missing feature / found alternative / temporary break / other
- On reason selection → `cancellation_reason_selected` event + then show the actual cancel confirm.
- "Temporary break" routes to pause flow (A3).

#### A5 — Progressive WinBackBanner

Replace permanent dismiss with escalating offers based on `downgradedAt`:
- **D0-2** — "Miss unlimited? Upgrade now" (neutral)
- **D3-7** — "7 forgotten subscriptions waiting to be tracked" (loss framing, dynamic count)
- **D8-30** — "Come back with 1 month at 50% off" (real RC promotional offer if available, else yearly default-selected)
- After D30 — hide.

Dismissal persists 24h only (not forever). Separate AsyncStorage key per bucket prevents re-showing within bucket.

### Files touched

**Modify:**
- `src/components/CancellationInterceptModal.tsx` — honest copy, step-2 reason selector, pause option
- `app/subscription-plan.tsx` — wire intercept modal into cancel flow
- `src/components/WinBackBanner.tsx` — progressive bucketing + 24h dismiss
- `src/services/analytics.ts` — new events
- `src/locales/*.json` (10 files) — new i18n keys

---

## Sub-Project B — Annual Upgrade Nudge

### Problem

Monthly Pro subscribers stay monthly forever. Annual LTV is ~1.5x monthly for same user. No proactive nudge exists.

### Changes

#### B1 — AnnualUpgradeBanner component

New `src/components/AnnualUpgradeBanner.tsx` rendered:
- On Dashboard, above content, for `plan === 'pro' && billingPeriod === 'monthly' && daysSinceStart >= 30`
- Text: "Switch to yearly — save $X.XX/year" (real savings calc: `monthlyPrice*12 - yearlyPrice`)
- Tap → `/paywall?prefill=pro-yearly` (paywall auto-selects yearly + Pro)

#### B2 — subscription-plan.tsx upgrade nudge

When user is monthly Pro and on this screen, show an inline banner at top suggesting "Switch to yearly, save $X" — separate from plan cards.

#### B3 — One-tap yearly switch in paywall

When paywall opens with `?prefill=pro-yearly` query param, pre-select Pro + Yearly. No other change to paywall logic.

#### B4 — AsyncStorage dismissal

`annual_nudge_dismissed_at` — hide banner for 7 days after dismiss, re-show after.

### Data source for "days since start"

`billing.currentPeriodEnd - 30 days` gives approximate start of current period (for monthly). When user has been Pro for > 30 days, `currentPeriodEnd` is always current period's end (one month ahead). A simpler and equivalent proxy: show nudge whenever `billingPeriod === 'monthly'` AND dismiss-timestamp is older than 7 days. Sessions effectively gate this.

Accepting the simpler approach: any monthly Pro user who hasn't dismissed in 7 days sees the nudge.

### Files touched

**Create:**
- `src/components/AnnualUpgradeBanner.tsx`

**Modify:**
- `app/(tabs)/index.tsx` — mount banner
- `app/subscription-plan.tsx` — mount banner in appropriate state
- `app/paywall.tsx` — honor `prefill` query param (yearly+pro preselect)
- `src/services/analytics.ts` — `annual_nudge_shown`, `annual_nudge_tapped`, `annual_nudge_dismissed`
- `src/locales/*.json` — i18n

---

## Sub-Project C — Family Plan Explainer + ICP Segmentation

### Problem

Team plan is called "Team" in UI but targets families too (ICP #4 "Family Financier" from growth doc). Users see $9.99 and think "too expensive — I'm not a business". No moment explains:
1. What Team actually does (invite flow → shared household visibility → duplicate detection)
2. How the math works ($9.99 ÷ 4 = $2.50/person vs $2.99/person on separate Pros)
3. Who it's for (families, couples, dev teams, flatmates)

### Changes

#### C1 — TeamExplainerModal

New `src/components/TeamExplainerModal.tsx`:
- 3-step visual explainer (swipeable or scrollable)
  1. **"Invite your household"** — visual: 4 avatars connected
  2. **"Everyone tracks in one place"** — visual: 4 dashboards merging into 1
  3. **"Spot duplicates instantly"** — visual: 3 Netflix icons → 1 shared
- Personalized math section: "Your household of 4 saves $X vs 4 separate Pros"
- CTA: "Start Team trial" → `/paywall?prefill=org-yearly`
- Secondary: "Just me" → dismisses + stores `family_preference=solo`

#### C2 — ICP segmentation question in onboarding

New onboarding step just before the money-loss hook:
- "Who tracks subscriptions?" → [🙋 Just me] / [👨‍👩‍👧 My family] / [💼 Our team]
- Stores `user.icp_segment` in settings store — used later to:
  - Show TeamExplainerModal earlier for family/team-selected users
  - Skip it for solo users
  - Adjust paywall hero ("You") vs ("Your household") copy
- Completely skippable (no modal trap).

#### C3 — Workspace tab entry reinforcement

When solo-segmented user taps Workspace tab → show TeamExplainerModal instead of bare feature list. When family/team-segmented user → show current Workspace screen.

### Files touched

**Create:**
- `src/components/TeamExplainerModal.tsx`

**Modify:**
- `app/onboarding.tsx` — add ICP question step
- `src/stores/settingsStore.ts` — store `icpSegment: 'solo' | 'family' | 'team' | null`
- `app/(tabs)/workspace.tsx` — conditional render
- `app/paywall.tsx` — honor `prefill=org-yearly`, personalize hero by segment
- `src/services/analytics.ts` — `icp_selected`, `team_explainer_viewed`, `team_explainer_cta`
- `src/locales/*.json` — i18n

---

## Sub-Project D — Free Limit Soft-Gate + Aha Triggers

### Problems

1. `FREE_LIMITS.maxSubscriptions = 3` in `src/hooks/usePlanLimits.ts:7` but `docs/BILLING_RULES.md` says `5`. Trust-breaking inconsistency. Server-side is authoritative via `billing.subscriptionLimit` but the constant is still used as fallback.
2. Hitting the limit is abrupt — no "almost there" warning.
3. `BILLING_RULES.md` trial trigger says "after 2 subscriptions added" — not implemented anywhere in code (grep finds no matching logic).

### Changes

#### D1 — Unify limit

Pick **3** as the canonical number (data: 3-limit triggers upgrade earlier, recommended by the growth doc). Update:
- `docs/BILLING_RULES.md` → 3 (and note that server may override).
- Keep client constant `FREE_LIMITS.maxSubscriptions = 3`.
- In `usePlanLimits` prefer `billing.subscriptionLimit ?? FREE_LIMITS.maxSubscriptions` so server can still override.

#### D2 — Soft limit warning banner

When `!isPro && activeCount === maxSubscriptions - 1` (i.e. 2/3):
- Show a warning row above the subscription list: "Only 1 free slot left — upgrade to track unlimited"
- Tap → `/paywall`
- Non-dismissable while condition holds — disappears when user upgrades or deletes a sub.

#### D3 — Aha-moment trial trigger

When user adds their 2nd subscription AND `canTrial && !trialUsed`:
- Show `TrialOfferModal` with enhanced copy:
  - "You're tracking $X/mo — unlock the full picture"
  - Uses `userMonthly` calc already present in paywall.
- This matches BILLING_RULES.md trial trigger logic.
- AsyncStorage flag `trial_offer_shown_count` — show max 2 times.

### Files touched

**Modify:**
- `src/hooks/usePlanLimits.ts` — prefer server limit
- `docs/BILLING_RULES.md` — normalize to 3
- `app/(tabs)/subscriptions.tsx` — soft warning banner at activeCount = max-1
- `src/components/AddSubscriptionSheet.tsx` — trigger TrialOfferModal on 2nd sub add
- `src/components/TrialOfferModal.tsx` — add personalized monthly-spend line
- `src/services/analytics.ts` — `soft_limit_warning_shown`, `aha_trial_offer_shown`
- `src/locales/*.json` — i18n

---

## Cross-cutting concerns

### Analytics events (total new)

```
cancellation_reason_selected { reason }
cancellation_paused_tapped
winback_banner_shown { bucket: 'd0_2' | 'd3_7' | 'd8_30' }
winback_banner_tapped { bucket }
annual_nudge_shown { location: 'dashboard' | 'subscription_plan' }
annual_nudge_tapped
annual_nudge_dismissed
icp_selected { segment }
team_explainer_viewed { source }
team_explainer_cta_tapped
soft_limit_warning_shown
aha_trial_offer_shown { trigger: 'second_sub' }
```

### i18n keys

All new strings must be added to all 10 locales: `en, ru, ja, ko, zh, de, es, fr, pt, kk`. English = source of truth; others can start as copies of English for non-critical strings and be refined by user separately. Russian always filled properly (primary user language).

### Respect user's "no EAS builds" preference

This work only creates files and edits JS/TS — zero EAS builds. User runs builds manually.

### Non-goals

- No changes to RevenueCat integration or IAP flow
- No changes to backend (analytics events forwarded via existing Amplitude)
- No changes to onboarding auth flow (Google/Apple)
- No real "50% off" promotional offer without RC dashboard setup — we use honest framing instead, and link to Apple manage-subscriptions for pause. If user later configures RC promotional offer, we wire it in a follow-up.

## Sequencing

Execution order (chosen for lowest-risk, biggest-impact-first):

1. **D1** — unify free limit (1 file edit, unblocks trust)
2. **A1+A2+A3+A4** — cancellation hardening (biggest revenue save)
3. **A5** — progressive win-back
4. **B1-B4** — annual upgrade nudge
5. **C1-C3** — family explainer + ICP segmentation
6. **D2+D3** — soft limit + aha trigger
7. **i18n sweep** — make sure all 10 locales have keys
8. **Verification** — tsc, smoke-test imports, visual sanity
