# Magic Add — Design Spec

**Date:** 2026-05-08
**Status:** In flight (user explicitly authorized self-driven implementation)
**Owner:** Mobile + Backend
**Builds on:** `2026-05-04-gmail-import-design.md` (Gmail OAuth + bulk-scan are already shipped end-to-end)

---

## 1. Context

Gmail bulk-scan + screenshot parser already exist as functional features but live in disconnected places:

- Gmail bulk-import is reachable only from Settings → Connected Accounts → Connect Gmail. The user must already know it exists. **Discoverability ≈ 0.**
- Camera/screenshot parsing lives as a generic "Take a photo" tile next to "Type it in" — unbranded, looks like a manual chore rather than a magic AI feature.
- Magic Mail (Gmail) is Pro/Team-gated on the backend, but the mobile UI doesn't lock the entry point or surface a paywall handoff.

The user request: collapse all AI input methods into a single beautifully-branded "magic" cluster on the Add Subscription screen, gate the bulk methods to Pro/Team with a clean paywall handoff, and add per-user daily rate limits to keep abuse + Gmail API quota safe.

## 2. Goals & Non-goals

### Goals
- Discoverable: from the Add screen, a Pro user sees Magic Mail as a first-class option without digging into Settings
- Branded: "Magic Image" + "Magic Mail" replace "Take a photo" / hidden Settings link — premium-feel iconography (sparkle/gradient)
- Gated: Free users see Magic Mail as locked with a subtle premium badge; tap → paywall with `feature=magic_mail` analytics tag
- Bounded: Magic Mail capped per-day per-user (Pro 3/day, Team 10/day) on top of the existing 2/min throttle and 200-msg per-scan cap
- Backward-compatible: old App Store builds (≤ 1.3.x) keep working without any change; new build only adds a new tile
- i18n: all 10 supported locales

### Non-goals
- Touching the Voice hero (already strong)
- Adding new AI endpoints (uses existing `/gmail/scan` and `/ai/parse-screenshot`)
- Onboarding step for Gmail (deferred to R3 per gmail-import spec)
- Background sync, push, two-way sync — out of scope
- Outlook / iCloud / IMAP — separate releases

## 3. Decisions

| # | Decision | Rationale |
|---|---|---|
| M1 | **3 tiles** in Add Sheet: `Magic Image` / `Magic Mail` / `Manual` (replaces current 2-tile Photo + Manual row). Voice hero stays untouched. | Same vertical density as today, no scroll added. |
| M2 | **"Magic Image" rebrand** — sparkle icon + purple/pink gradient circle. Existing `onCamera` callback unchanged. NOT Pro-gated (works on AI credits like today). | Marketing polish only — no behavior change, no risk to existing AI-credits flow. |
| M3 | **"Magic Mail" tile** — mail icon + amber/gold gradient circle. Routes to existing `/gmail-import` screen. | Visual hook differentiates from Magic Image (purple) so the user reads them as siblings, not duplicates. |
| M4 | **Pro/Team gating:** Free users see Magic Mail tile with a small lock badge in the corner. Tap shows paywall (`router.push('/paywall?feature=magic_mail')`). | Same pattern as other premium gates in the app. Visible-but-locked > hidden — drives upsell. |
| M5 | **Magic Image stays available to Free** (constrained by AI credits). Only Magic Mail is plan-gated. | Matches gmail-import D2: AI credits for one-shot parses, plan-gating for bulk. |
| M6 | **Per-user daily limit on `/gmail/scan`:** Pro = 3 scans/day, Team = 10 scans/day. Enforced via Redis counter keyed by `gmail:scan:daily:<userId>:<YYYYMMDD>` with TTL = end of UTC day. Returns 429 with `nextResetAt` in body. | Caps abuse; aligns with the existing 2/min throttle but covers the longer window. Per-user, not global, so one user can't starve others. |
| M7 | **Mobile shows `nextResetAt`** in the Gmail import screen if the user hits the daily cap, instead of a generic "rate limited" toast. | Lets the user understand when to retry. |
| M8 | **Analytics:** track `add.magic_image.tap`, `add.magic_mail.tap`, `add.magic_mail.locked_tap` (Free user tap), `gmail.scan.rate_limited`. Reuse existing `paywall.viewed` event with `source: 'feature_gate'` and `feature_id: 'magic_mail'`. | Lets us measure conversion from Magic Mail tap → paywall view → purchase. |
| M9 | **No new entitlement** — uses existing `useEffectiveAccess()` to detect Pro/Team. | Don't fork the gating logic; the truth lives in one place. |
| M10 | **i18n keys:** `add.magic_image_title/desc`, `add.magic_mail_title/desc`, `add.magic_mail_locked_hint`, `gmail.daily_limit_title/body`, `paywall.feature.magic_mail.title/desc`. All 10 locales. | Mandatory per CLAUDE.md `feedback_always_translate.md`. |

## 4. UX Layout

```
┌──────────────────────────────────────────┐
│            Add Subscription              │
│              (header sheet)              │
│                                          │
│        ┌──────────────────┐              │  ← VOICE hero (unchanged)
│        │   ╭─────────╮    │              │
│        │   │   🎙   │    │              │
│        │   ╰─────────╯    │              │
│        └──────────────────┘              │
│           Just say it                    │
│  "Netflix 15 dollars monthly" — and …    │
│                                          │
│  ─────────── or ───────────              │
│                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│  │  ✨📷   │ │  ✨📧🔒 │ │   ✏️   │     │  ← 3 tiles (M1)
│  │  Magic  │ │  Magic  │ │ Type it │     │
│  │  Image  │ │  Mail   │ │   in    │     │
│  │ Snap a  │ │ Scan    │ │ Fill in │     │
│  │ receipt │ │ Gmail   │ │ details │     │
│  └─────────┘ └─────────┘ └─────────┘     │
│                                          │
│  Smart input ▾                           │
└──────────────────────────────────────────┘
```

- Tile dimensions identical to current Photo/Manual tiles (single-row flex with `gap: 10`).
- Lock badge for Free users: small filled circle top-right of the Magic Mail tile, `Ionicons name="lock-closed"` 14px, in `colors.warning` (amber).
- Sparkle decoration overlay on icon wraps for Magic Image + Magic Mail (a tiny `sparkles-outline` 12px in top-right of the icon circle, semi-transparent) — visual cue for "AI / magic" without being noisy.

## 5. Architecture

### Mobile

| File | Change |
|---|---|
| [src/components/add-subscription/IdleView.tsx](src/components/add-subscription/IdleView.tsx) | Replace 2-tile row with 3-tile row. Add `onMagicMail` prop, `lockedMagicMail` boolean prop. Add sparkle overlays + lock badge. |
| [src/components/AddSubscriptionSheet.tsx](src/components/AddSubscriptionSheet.tsx) | Wire `onMagicMail` callback: if Pro/Team → `router.push('/gmail-import')`; if Free → `router.push('/paywall?feature=magic_mail')`. Pass `lockedMagicMail` from `useEffectiveAccess()`. |
| [src/services/analytics.ts](src/services/analytics.ts) | New events: `addMagicImageTap`, `addMagicMailTap`, `addMagicMailLockedTap`, `gmailScanRateLimited`. |
| `app/gmail-import.tsx` | Detect 429 with `nextResetAt` in error body → show modal with reset time instead of generic alert. |
| `src/locales/*.json` | New keys (10 locales): `add.magic_image_*`, `add.magic_mail_*`, `gmail.daily_limit_*`, `paywall.feature.magic_mail.*`. |

### Backend

| File | Change |
|---|---|
| [src/gmail/gmail.controller.ts](https://github.com/timurzharlykpaev/subradar-backend/blob/main/src/gmail/gmail.controller.ts) | Add daily rate-limit check before delegating to scan service. On hit → throw `HttpException({code:'DAILY_LIMIT', nextResetAt:<iso>}, 429)`. |
| [src/gmail/gmail-scan.service.ts](https://github.com/timurzharlykpaev/subradar-backend/blob/main/src/gmail/gmail-scan.service.ts) | New helper `checkAndIncrementDailyQuota(userId, plan)` using Redis SETNX + INCR + EXPIRE. Pro = 3, Team = 10. |
| `src/gmail/gmail-scan.service.spec.ts` | Tests for the daily-quota helper (under cap / at cap / counter resets at UTC midnight). |

## 6. Data Flow

**Free user → tap Magic Mail tile:**
```
IdleView.onMagicMailPress
  → analytics.addMagicMailLockedTap()
  → router.push('/paywall?feature=magic_mail')
  → paywall analytics.paywallViewed('feature_gate', { feature_id: 'magic_mail' })
```

**Pro user → tap Magic Mail tile:**
```
IdleView.onMagicMailPress
  → analytics.addMagicMailTap()
  → router.push('/gmail-import')
  → existing gmail-import flow (connect or scan)
```

**Pro user → 4th scan in 24h:**
```
gmail-import.handleScan()
  → POST /gmail/scan
  ← 429 { code: 'DAILY_LIMIT', nextResetAt: '2026-05-09T00:00:00Z' }
  → analytics.gmailScanRateLimited()
  → Alert with "Daily scan limit reached. Try again at <time>"
```

## 7. Backward Compatibility

- Old mobile clients (≤ 1.3.x) don't call `/gmail/scan` at all (the endpoint was added in this CASA branch already in main). Backend changes here only add a 429 path on a brand-new endpoint — invisible to them.
- The Magic Image rebrand is a label + icon change in IdleView only. No prop or callback signature changes — `onCamera` stays the function the AddSubscriptionSheet passes today.
- The 3-tile row is an additive UI change. Sheet height grows by zero (tiles fit in the same row width).
- No DTO change, no API rename, no enum change. Old apps continue with their existing 2-tile UI; new apps see 3 tiles.

## 8. Testing

- Mobile unit: re-run snapshot for IdleView. Add tests for IdleView's `lockedMagicMail` prop rendering the lock badge. Test that `onMagicMail` fires analytics + routes correctly for Free vs Pro.
- Backend unit: tests for `checkAndIncrementDailyQuota` — under cap allows, at cap throws, counter increments, key TTL set.
- Smoke: `npm run typecheck` + `npm test` in both repos.
- Manual: Free user → tap Magic Mail → paywall opens with feature_gate source. Pro user → tap → gmail-import. 4th scan → 429 with reset time.

## 9. Rollout

- **Single PR per repo**, merged to `dev` then `main` (auto-deploy via existing pipelines).
- No version bump on mobile in this iteration — feature is server-compat with existing builds. Bump to 1.4.0 on the next user-facing release that bundles enough changes to TestFlight.
- Mobile build will be triggered manually by the user (per `feedback_no_testflight.md`).

## 10. Open Questions / Risks

- **Gmail API quota**: per-user 3/day with 200 msg cap = 600 messages/day per Pro user. With 1k Pro users, worst case 600k Gmail API calls/day. Google's quota is 1B units/day with `messages.list` = 5 units, `messages.get` = 5 units. We're 3 orders of magnitude under. Safe.
- **Old build users hitting paywall via Magic Mail tile**: not possible — old builds don't have the tile.
- **What if a user disconnects Gmail mid-scan and the backend tries to refresh a revoked token?** Already handled in `gmail-scan.service.ts` (nulls token on 400/401). No new failure mode introduced here.
