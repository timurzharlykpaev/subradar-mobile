# Subscription Add Flow Redesign — Design Spec

**Date:** 2026-04-03
**Status:** Draft
**Scope:** Mobile (primary) + Backend (1 new endpoint)
**Repos:** subradar-mobile, subradar-backend (minimal)

---

## 1. Overview

Redesign the subscription creation flow to be faster, more cost-efficient, and more trustworthy. Key principles:

- **Zero-AI path for known services** via ServiceCatalog + local cache
- **Unified entry point** replacing 3-tab interface
- **Inline editing** in confirm card instead of separate edit screen
- **Confidence indicators** so users know what AI inferred vs what's certain
- **Voice transcription editing** before AI parse to prevent wasted credits
- **Smart bulk routing** — only send unknown services to AI

### Expected Impact

- 50-70% reduction in AI calls for typical user
- Faster add flow (instant for known services)
- Better data quality (confidence signals + inline editing)
- Graceful degradation when AI unavailable

---

## 2. Unified Entry Point

### Current State

3 tabs: AI Assistant | Manual | Screenshot. User must choose input method before starting.

### New Design

Single screen with smart input field:

```
┌─────────────────────────────────────┐
│  ✕                  Add Subscription │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │ What do you subscribe to?   │    │
│  │                         🎤 📷│    │
│  └─────────────────────────────┘    │
│                                     │
│  Quick add:                         │
│  [Netflix] [Spotify] [ChatGPT]      │
│  [iCloud] [YouTube] [Disney+]       │
│  [+ More...]                        │
│                                     │
│  ─── or enter manually ───          │
│  [Manual form ▼]                    │
│                                     │
│  AI credits: 3/5 remaining          │
└─────────────────────────────────────┘
```

### Input Routing Logic

```
Input received
     │
     ├─ Tap quick chip → ServiceCatalog lookup (0 AI)
     │    └─ found → Confirm card (instant)
     │
     ├─ Tap 🎤 → Record → Transcription → show editable text
     │    └─ user edits/confirms → route as text below
     │
     ├─ Tap 📷 → Pick image → /ai/parse-screenshot (1 AI)
     │    └─ results → Bulk confirm or Single confirm
     │
     ├─ Type text, looks like single service ("Netflix")
     │    ├─ Check local cache → hit → Confirm card (0 AI)
     │    ├─ Check ServiceCatalog endpoint → hit → Confirm card (0 AI)
     │    └─ miss → /ai/wizard (1 AI)
     │
     └─ Type text, looks like multiple ("Netflix 15, Spotify 10")
          ├─ Client-side split + regex price extraction
          ├─ Lookup each in cache/ServiceCatalog
          └─ /ai/parse-bulk ONLY for unknown services (0-1 AI)
```

### Single vs Bulk Detection (client-side regex)

Input is treated as bulk if it contains: comma, slash, "and"/"и", "plus"/"плюс", newline, or price pattern next to service name.

### Quick Chips

**Static (hardcoded, 0 AI):** Netflix, Spotify, ChatGPT, iCloud, YouTube Premium, Disney+, Apple Music, Amazon Prime — with full plan data embedded.

**Dynamic (from ServiceCatalog, 0 AI):** Top-8 by popularity, fetched once and cached in AsyncStorage.

### Manual Form

Below unified input — link "or enter manually". Expands to:
- Name, Amount, Currency, Period — always visible
- Category — now visible by default (chips, no longer hidden)
- Rest behind "More options"

### AI Credits Badge

Free users: "3/5 AI credits" at bottom of sheet. Pro users: hidden (200 is plenty).

---

## 3. Client-Side Cache & ServiceCatalog Integration

### Three-Level Lookup (before AI)

```
User types "Netflix"
        │
        ▼
[1] Local Cache (AsyncStorage)
        │ key: "subradar:lookup-cache"
        │ Format: { [normalizedName]: { data, cachedAt } }
        │ TTL: 7 days
        │ hit? → return cached data (0 AI, 0 network)
        ▼
[2] ServiceCatalog endpoint (new)
        │ GET /ai/service-catalog/:normalizedName
        │ Pure DB lookup, no AI call (<50ms)
        │ hit? → return + save to local cache (0 AI, 1 network)
        ▼
[3] AI Wizard (existing)
        │ POST /ai/wizard
        │ hit? → return + save to local cache (1 AI credit)
        ▼
[4] Manual fallback
        │ "Not found? Enter manually"
```

### New Backend Endpoint

```
GET /ai/service-catalog/:normalizedName
```

Looks up `service_catalog` table by `normalizedName` (using existing `MarketDataService.normalizeServiceName()`).

Response 200:
```json
{
  "name": "Netflix",
  "category": "STREAMING",
  "iconUrl": "https://icon.horse/icon/netflix.com",
  "serviceUrl": "https://netflix.com",
  "cancelUrl": "https://netflix.com/cancelplan",
  "plans": [
    { "name": "Standard with Ads", "priceMonthly": 7.99, "currency": "USD" },
    { "name": "Standard", "priceMonthly": 15.49, "currency": "USD" },
    { "name": "Premium", "priceMonthly": 22.99, "currency": "USD" }
  ]
}
```

Response 404: `{ "error": "NOT_FOUND" }`

This endpoint does NOT call AI — pure database lookup.

### Local Cache Structure

```ts
interface LookupCacheEntry {
  data: {
    name: string;
    category: string;
    iconUrl?: string;
    serviceUrl?: string;
    cancelUrl?: string;
    plans?: { name: string; priceMonthly: number; currency: string }[];
  };
  cachedAt: number;
}

// AsyncStorage key: "subradar:lookup-cache"
// Value: { [normalizedName: string]: LookupCacheEntry }
// TTL: 7 days (check cachedAt before returning)
```

### Input Deduplication

```ts
function getInputHash(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Before AI call: check if same input was processed in last 5 minutes
// Prevents: re-parsing same text, double-tap, re-adding deleted sub
```

### Cost Savings Projection

| Scenario | Current | After |
|----------|---------|-------|
| Quick chip (Netflix) | 0 AI | 0 AI |
| Type "Netflix" | 1 AI (wizard) | 0 AI (ServiceCatalog) |
| Type "Netflix" again | 1 AI (wizard) | 0 AI (local cache) |
| Type "SomeNicheService" | 1 AI (wizard) | 1 AI (cache miss) |
| Bulk "Netflix, Spotify, ChatGPT" | 1 AI (parse-bulk) | 0 AI (all in catalog) |
| Voice → single known | 1.5 AI | 0.5 AI (audio only) |

---

## 4. Voice Flow — Transcription Editing

### Current Problem

Voice → transcription → immediate AI parse. Whisper errors waste AI credits on garbled input.

### New Flow

```
[🎤 Tap mic] → Recording (max 30s)
        │
        ▼
[Transcription] → /ai/parse-audio (0.5 AI credit)
        │
        ▼
┌─────────────────────────────────────┐
│  🎤 I heard:                         │
│  ┌─────────────────────────────────┐ │
│  │ Netflix 15 dollars, Spotifi 10  │ │
│  │ dollars monthly                 │ │
│  └─────────────────────────────────┘ │
│                                      │
│  [✏️ Edit]          [✓ Looks good]   │
└──────────────────────────────────────┘
```

- **"Edit"** — user corrects text in input field, then confirms
- **"Looks good"** — text routes through standard routing (cache → catalog → AI)
- Transcription errors caught BEFORE spending AI credit on parsing
- No backend changes needed — `/ai/parse-audio` already returns `{ text }`

---

## 5. Confirm Card — Inline Editing & Confidence

### Current Problem

Confirm card is read-only. Editing requires "Edit Details" → full manual form → lose context.

### New Confirm Card

```
┌─────────────────────────────────────┐
│  ┌────┐                             │
│  │ 🎬 │  Netflix                     │
│  └────┘  netflix.com                 │
├─────────────────────────────────────┤
│                                     │
│  Plan:  [Standard ▾]                │
│         ○ Standard with Ads  $7.99   │
│         ● Standard           $15.49  │
│         ○ Premium            $22.99  │
│                                     │
│  Amount:    [$15.49]  ← editable    │
│  Currency:  [USD ▾]                  │
│  Period:    [Monthly ▾]              │
│  Category:  [🎬 Streaming]  ✅       │
│  Start:     [2026-04-03]            │
│                                     │
│  ──── More ────                     │
│  Card, Notes, Tags, Trial...        │
│                                     │
│      [Add Subscription]             │
└─────────────────────────────────────┘
```

### Key Changes

**1. Inline Plan Selection:** If ServiceCatalog returned plans → radio list in confirm card. Selecting plan auto-fills amount. No plans → just editable amount field.

**2. All Fields Editable In-Place:** Each field is tappable. Amount = input. Currency/Period = dropdown. Category = chip selector. No separate "Edit Details" screen.

**3. Confidence Indicators:**

```
✅ — high confidence (from ServiceCatalog or explicit user input)
⚠️ — medium confidence (AI inferred, may be inaccurate)
❓ — low/missing (needs user confirmation)
```

Assignment logic:
- From ServiceCatalog → all ✅
- From AI wizard → name ✅, amount ⚠️ (if not from catalog), category ⚠️
- From voice/bulk parse → name ⚠️, amount ⚠️, period ⚠️
- Missing field → ❓ (highlighted, visual hint to fill)

**4. "More" Section:** Collapsible block with: Payment Card, Notes, Tags, Trial toggle + end date, Service URL / Cancel URL, Reminder settings. Same fields as manual form, but accessible from confirm card.

**5. Single "Add Subscription" Button:** Remove "Add" + "Edit Details" dual buttons. One path — everything inline.

### Bulk Confirm

For multiple subscriptions — collapsible card list:

```
┌─────────────────────────────────────┐
│ ☑️ Netflix         $15.49/mo    [▾] │
│ ☑️ Spotify         $11.99/mo    [▸] │
│ ⚠️ Spotifi         $10.00/mo    [▸] │
│    ↑ "Did you mean Spotify?"        │
│ ☑️ ChatGPT Plus    $20.00/mo    [▸] │
│                                     │
│  [Select All] [Deselect All]        │
│      [Add 3 Subscriptions]          │
└─────────────────────────────────────┘
```

- `[▾]` expanded (inline edit visible), `[▸]` collapsed (name + price only)
- Tap card → toggle expand/collapse

### Client-Side Duplicate Detection

Before showing confirm:
1. Normalize name (`toLowerCase().trim()`)
2. Compare with `subscriptionsStore.subscriptions`
3. Exact match → `⚠️ "You already have Netflix"`
4. Fuzzy match (Levenshtein < 3 or contains) → `⚠️ "Did you mean Spotify?"`
5. User can: confirm add (second account) or cancel (duplicate)

All client-side, 0 AI calls.

---

## 6. Cost Control & Abuse Prevention

### Client-Side Rate Limiting

Pre-check before AI calls (don't wait for 429):

```ts
const remaining = aiRequestsLimit - aiRequestsUsed;
if (remaining <= 0) → show ProFeatureModal immediately
if (remaining <= 2) → show yellow warning "2 AI credits left"
```

### Token Optimization

**History trimming:** Wizard conversation history limited to last 4 messages (2 user + 2 assistant). `partialContext` already carries accumulated data.

**Screenshot compression:** Before upload — resize to max 1024px width, JPEG quality 0.7. Reduces payload 3-5x.

```ts
const manipulated = await ImageManipulator.manipulateAsync(
  uri,
  [{ resize: { width: 1024 } }],
  { compress: 0.7, format: SaveFormat.JPEG }
);
```

### Deduplication

5-minute TTL cache keyed by `endpoint + hash(payload)`. Prevents:
- Re-parsing same screenshot
- Re-sending same text to wizard
- Double-tap on buttons

### Graceful Degradation

```
AI unavailable (timeout/500/rate-limit)
     ├─ ServiceCatalog endpoint available? → partial data (0 AI)
     ├─ Local cache available? → use cached (even if expired)
     └─ Nothing available → "AI temporarily unavailable. Add manually."
                            [Switch to manual form]
```

Manual add ALWAYS works. No AI failure blocks subscription creation.

### Retry Logic

- AI calls: max 1 retry with 2s backoff
- No retry on 429 (rate limit) → show upgrade immediately
- No retry on 400 (bad input) → show error
- Retry only on 500/timeout

### Smart Bulk Optimization

For input "Netflix $15, Spotify $10, SomeNiche $5":

```
1. Client-side split by comma/newline
2. Regex extract name + price from each chunk
3. Lookup each name in cache/ServiceCatalog
4. Netflix → cache hit (0 AI)
5. Spotify → cache hit (0 AI)
6. SomeNiche → miss → collect unknowns
7. Send ONLY unknowns to /ai/parse-bulk: "SomeNiche $5"
8. Merge all results → show bulk confirm
```

### Client-Side Price Regex

```ts
const PRICE_PATTERNS = [
  /^(.+?)\s*[\$€£₽]\s*(\d+[\.,]?\d*)/,           // Netflix $15.49
  /^(.+?)\s+(\d+[\.,]?\d*)\s*[\$€£₽]/,            // Netflix 15.49$
  /^(.+?)\s+(\d+[\.,]?\d*)\s*(dollars?|usd|eur)/i, // Netflix 15 dollars
  /^(.+?)\s+(\d+[\.,]?\d*)\s*(руб|₽|rub)/i,        // Netflix 500 руб
];
```

Pure regex, no AI. Covers ~80% of input formats.

---

## 7. Post-Save UX & Onboarding

### Post-Save — "Add Another"

Current: success overlay → auto-close. Adding more requires re-opening sheet.

New — success with choices:

```
┌─────────────────────────────────────┐
│  ✅ Netflix added!                   │
│  [Add another]     [Done]           │
└─────────────────────────────────────┘
```

- **"Add another"** — reset form, keep sheet open, focus input
- **"Done"** — close sheet

### Undo Toast (5 seconds)

After save — bottom toast:

```
┌─────────────────────────────────────┐
│  Netflix added          [Undo]      │
│  ━━━━━━━━━━━━━━━━━░░░░ 3s           │
└─────────────────────────────────────┘
```

- 5 second countdown with progress bar
- Tap "Undo" → `DELETE /subscriptions/:id` → remove from store
- After 5s → toast disappears, subscription confirmed
- Bulk: "5 subscriptions added [Undo all]"

### First-Time Onboarding

On first Add sheet open after signup/login (flag `subradar:add-onboarding-seen` in AsyncStorage). Checked on sheet mount — if flag absent, show onboarding instead of normal UI:

```
┌─────────────────────────────────────┐
│  📱 Add your subscriptions          │
│                                     │
│  Try saying:                        │
│  "Netflix 15 dollars, Spotify 10,   │
│   ChatGPT 20 monthly"              │
│                                     │
│  Or tap a service below:            │
│  [Netflix] [Spotify] [ChatGPT]...   │
│                                     │
│  [Got it]                           │
└─────────────────────────────────────┘
```

Shown once. After "Got it" → normal unified input.

---

## 8. AI vs Deterministic — Complete Map

### Deterministic (0 AI)

| Operation | Where | How |
|-----------|-------|-----|
| Quick chip → confirm | Client | Hardcoded data |
| Lookup known service | Backend | `GET /ai/service-catalog/:name` (DB query) |
| Duplicate detection | Client | Compare names in subscriptionsStore |
| Fuzzy match ("Spotifi" → "Spotify") | Client | Levenshtein distance < 3 |
| Category normalization | Client | Regex + mapping table |
| Currency/period normalization | Client | Mapping tables |
| Billing day inference | Client | Extract from startDate |
| Icon URL generation | Client | `icon.horse/icon/{domain}` |
| Input hash dedup | Client | `hash(input.toLowerCase().trim())` |
| Plan limits pre-check | Client | billingStatus from store |
| Price extraction from text | Client | Regex patterns |
| Single vs bulk detection | Client | Regex (comma, "and", price patterns) |
| Validation | Client | Form validation |
| Screenshot compression | Client | ImageManipulator |

### AI-Required

| Operation | Endpoint | When |
|-----------|----------|------|
| Voice transcription | `/ai/parse-audio` | Always on voice (Whisper) |
| Unknown service parse | `/ai/wizard` | Only if ServiceCatalog miss |
| Bulk parse (unknowns) | `/ai/parse-bulk` | Only for services not in catalog |
| Screenshot OCR | `/ai/parse-screenshot` | Always on screenshot |
| Wizard follow-up | `/ai/wizard` | Only if AI needs clarification |

---

## 9. Implementation Scope

### Backend (minimal)

- 1 new endpoint: `GET /ai/service-catalog/:normalizedName` in existing AI controller
- Uses existing `MarketDataService` and `ServiceCatalog` entity

### Mobile (primary scope)

**New components:**
- `UnifiedAddSheet.tsx` — replaces AddSubscriptionSheet, single entry point
- `TranscriptionConfirm.tsx` — voice transcription edit step
- `InlineConfirmCard.tsx` — editable confirm card with confidence indicators
- `BulkConfirmList.tsx` — collapsible bulk confirm list
- `UndoToast.tsx` — post-save undo toast
- `AddOnboarding.tsx` — first-time hint overlay
- `AICreditsBadge.tsx` — remaining credits display

**New services:**
- `src/services/lookupCache.ts` — AsyncStorage cache with TTL
- `src/services/clientParser.ts` — regex price extraction, single/bulk detection, normalization
- `src/services/catalogLookup.ts` — three-level lookup orchestration (cache → catalog → AI)

**Modified components:**
- `AIWizard.tsx` — integrate with catalogLookup instead of always calling AI
- `BulkAddSheet.tsx` — use smart bulk routing

**New API:**
- `src/api/analysis.ts` — add `getServiceCatalog(name)` method (or extend `ai.ts`)

**i18n keys:** Add to all 10 locales (onboarding, transcription confirm, confidence labels, undo, credits)
