# Currency, Region & AI Catalog — Design Spec

**Date:** 2026-04-15
**Status:** Design approved, pending implementation plan
**Affects:** subradar-mobile, subradar-backend

---

## Problem Statement

Today SubRadar stores each subscription with a single `currency` field and displays amounts as-is. Consequences:

1. Changing the currency in Settings does not reconvert existing subscriptions — it only affects new defaults.
2. The AI lookup (`/ai/lookup`) returns generic prices (usually US-centric), not the actual price in the user's country (Netflix in Russia is not $15.49).
3. AI results are cached in Redis for 24h only; popular services burn tokens repeatedly, and prices drift without any refresh strategy.
4. Users have no way to say "I live in Kazakhstan but I want to see subscription totals in USD."

## Goals

- **Accurate prices per region.** AI prompts receive the user's region and return region-specific plans and prices.
- **Persistent catalog.** Services and plans are stored in the database, not just Redis, so they survive restarts and accumulate value.
- **Token-efficient refresh.** A weekly cron updates prices of top-used services; cold services are refreshed lazily on read.
- **Flexible display.** Users can display all subscriptions in a chosen currency (USD for expat math), while each subscription retains its original currency and amount forever.
- **Non-mutating semantics.** Changing region or display currency never rewrites the stored amount/currency of existing subscriptions. Those are historical facts.

## Non-Goals

- Retrospectively matching existing subscriptions to catalog entries. The catalog grows naturally from future lookups.
- Supporting cryptocurrencies or assets beyond ISO-4217 fiat.
- Real-time (sub-hour) FX accuracy. Daily snapshots with 6h Redis TTL are sufficient for subscription summaries.
- UI for browsing the catalog directly. The catalog is infrastructure; users interact with it only through AI lookup and price display.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Region and display currency are **separate** user settings | Real use case: expats living abroad paying local prices but wanting summary in USD |
| 2 | Normalized schema: `CatalogService` + `CatalogPlan` | JSON-of-plans would grow painful; normalized unlocks analytics ("find cheaper alternatives") without future migration |
| 3 | Combo cron + lazy refresh | Weekly top-50 by usage for predictable budget; lazy on read for the long tail |
| 4 | Backend-side currency conversion with `exchangerate.host` | Single source of truth, aggregations cheap, clients trivial |
| 5 | Two AI prompts: `full-research` (`gpt-4o`) and `price-refresh` (`gpt-4o-mini`) | 90% of cron work is price-only; cheap model is ~10× less expensive |
| 6 | Autodetect region via timezone on first run, editable later | Zero-click onboarding when correct; escape hatch in Settings |

---

## Data Model

### New entities (backend)

**`CatalogService`**
```
id                    UUID (PK)
slug                  VARCHAR(64) UNIQUE  -- "netflix", "spotify"
name                  VARCHAR(128)        -- "Netflix"
category              ENUM (existing CATEGORIES enum)
iconUrl               TEXT NULL
websiteUrl            TEXT NULL
aliases               TEXT[]              -- ["нетфликс", "netflix inc"]
lastResearchedAt      TIMESTAMPTZ
researchCount         INTEGER DEFAULT 0   -- how many users have looked this up
createdAt             TIMESTAMPTZ DEFAULT NOW()
```

**`CatalogPlan`**
```
id                    UUID (PK)
serviceId             UUID FK → CatalogService ON DELETE CASCADE
region                VARCHAR(2)          -- ISO-3166 alpha-2 ("US", "KZ")
planName              VARCHAR(128)        -- "Basic", "Premium", "Family"
price                 NUMERIC(19,4)
currency              VARCHAR(3)          -- ISO-4217 ("USD", "KZT")
period                ENUM (WEEKLY, MONTHLY, QUARTERLY, YEARLY, LIFETIME)
trialDays             INTEGER NULL
features              TEXT[] DEFAULT '{}' -- ["4K", "2 screens"]
priceSource           ENUM (AI_RESEARCH, USER_REPORTED, MANUAL) DEFAULT AI_RESEARCH
priceConfidence       ENUM (HIGH, MEDIUM, LOW) DEFAULT HIGH
lastPriceRefreshAt    TIMESTAMPTZ

UNIQUE (serviceId, region, planName)
INDEX (lastPriceRefreshAt)                -- cron queue ordering
INDEX (serviceId, region)                 -- lookup path
```

**`FxRateSnapshot`**
```
id                    UUID (PK)
base                  VARCHAR(3) DEFAULT 'USD'
rates                 JSONB                -- { "EUR": 0.92, "RUB": 92.5, "KZT": 445 }
fetchedAt             TIMESTAMPTZ DEFAULT NOW()
source                VARCHAR(64) DEFAULT 'exchangerate.host'

INDEX (fetchedAt DESC)
```

### Changes to existing entities

**`User`** (add columns)
```
+ region              VARCHAR(2) NOT NULL DEFAULT 'US'
+ displayCurrency     VARCHAR(3) NOT NULL DEFAULT 'USD'
+ timezoneDetected    VARCHAR(64) NULL
```

**`Subscription`** (add columns)
```
+ originalCurrency    VARCHAR(3) NOT NULL    -- snapshot at creation, never mutated
+ catalogServiceId    UUID FK → CatalogService NULL
+ catalogPlanId       UUID FK → CatalogPlan NULL
```

### Migration script
```sql
-- 1. User columns with backfill
ALTER TABLE users ADD COLUMN region VARCHAR(2), ADD COLUMN display_currency VARCHAR(3);
UPDATE users SET
  region = COALESCE(country, 'US'),
  display_currency = COALESCE(currency, 'USD');
ALTER TABLE users ALTER COLUMN region SET NOT NULL, ALTER COLUMN display_currency SET NOT NULL;

-- 2. Subscription.originalCurrency
ALTER TABLE subscriptions ADD COLUMN original_currency VARCHAR(3);
UPDATE subscriptions SET original_currency = currency WHERE original_currency IS NULL;
ALTER TABLE subscriptions ALTER COLUMN original_currency SET NOT NULL;
ALTER TABLE subscriptions
  ADD COLUMN catalog_service_id UUID NULL REFERENCES catalog_services(id),
  ADD COLUMN catalog_plan_id UUID NULL REFERENCES catalog_plans(id);

-- 3. New tables — created empty
```

No retroactive catalog linking for existing subscriptions. The catalog is built forward from future AI lookups.

---

## API Contracts

### New endpoints

```
GET /catalog/search?q=netflix&region=KZ
  → 200 [{
      serviceId, name, iconUrl, category, websiteUrl,
      plans: [{ planId, planName, price, currency, period, features, confidence }]
    }]
  Behavior:
    1. Match CatalogService.slug or aliases (fuzzy, case-insensitive)
    2. If found and any plan.lastPriceRefreshAt > 30d old → queue background refresh, still return stale
    3. If not found → full-research AI prompt → persist → return
    4. Redis lock ai:lookup:lock:<slug> TTL 60s dedupes concurrent calls

GET /catalog/service/:id?region=KZ&displayCurrency=USD
  → 200 { service, plans: [...with displayAmount/displayCurrency/fxRate] }

POST /catalog/refresh/:serviceId?region=KZ
  Admin/internal only. Bypasses TTL, triggers price-refresh immediately.

GET /fx/rates?base=USD
  → 200 { base, rates, fetchedAt, source }
  Public, cached client-side. Used only when backend can't convert (rare).

PATCH /users/me
  Body adds: { region?, displayCurrency? }
  On region change: response includes suggested displayCurrency for that region;
  client decides whether to apply it.
```

### Modified endpoints

```
GET /subscriptions
  + ?displayCurrency=USD (default: user.displayCurrency)
  Response per item:
    {
      ...existing,
      amount, currency,                  // original, immutable
      displayAmount, displayCurrency,    // converted at request time
      fxRate, fxFetchedAt                // for transparency in UI
    }

GET /analytics/summary
GET /analytics/monthly
GET /analytics/by-category
GET /analytics/by-card
GET /analytics/upcoming
  + ?displayCurrency=USD
  All monetary fields converted; original breakdown retained in a nested `byCurrency` field where useful.
```

### AI prompt strategy

**Full Research — `gpt-4o` with structured output**

Called when a service is missing from catalog. One call covers all user-active regions.

```
System: You are a SaaS subscription research assistant. Given a service name,
return JSON describing the service and its current publicly-listed plans
for each requested region. If a plan is unavailable in a region, omit it.
Be precise with currency and period. If uncertain about a price,
set confidence: "MEDIUM" or "LOW".

User: { query: "Netflix", regions: ["US", "RU", "KZ"] }

Response (json_schema enforced):
{
  service: { name, slug, category, iconUrl, websiteUrl, aliases },
  plans: [{ region, planName, price, currency, period, trialDays?, features[], confidence }]
}
```

**Price Refresh — `gpt-4o-mini` with structured output**

Called by cron and lazy refresh. Cheap, narrow.

```
System: Return ONLY current prices for the listed plans in the listed regions.
No descriptions, no new plans.

User: {
  service: "Netflix",
  regions: ["US", "RU", "KZ"],
  knownPlans: ["Basic", "Standard", "Premium"]
}

Response:
{
  prices: [{ region, planName, price, currency }],
  notes: "..."  // free-form; goes to logs, not DB
}
```

Deduplication: concurrent lookups for the same slug block on a Redis lock (`ai:lookup:lock:<slug>`, 60s) — only one AI call; the rest wait and read the result.

Budgeting: per-user daily cap on AI lookups (default 20 for Free, 200 for Pro). Cron has a global weekly cap (default 1000 refresh calls).

---

## FX Service

```ts
class FxService {
  async getRates(): Promise<{ base: 'USD'; rates: Record<string, number>; fetchedAt: Date; source: string }> {
    // 1. Redis fx:latest (TTL 6h)
    // 2. Miss → latest FxRateSnapshot row
    // 3. Snapshot > 24h old → fetch exchangerate.host → save snapshot → cache
    // 4. External API failed → return snapshot + log warning
    //    (never block subscription fetches on FX failure)
  }

  convert(amount: Decimal, from: string, to: string, rates: Record<string, number>): Decimal {
    if (from === to) return amount;
    const usd = amount.div(rates[from] ?? throw new Error(`No rate for ${from}`));
    return usd.mul(rates[to] ?? throw new Error(`No rate for ${to}`));
  }
}
```

Monetary arithmetic uses `Decimal` (`decimal.js`) throughout. Rounding applied only at the display edge with `Intl.NumberFormat`.

---

## Cron Jobs

```ts
@Cron('0 3 * * *')  // daily 03:00 UTC
async refreshFxRates() {
  const rates = await fetch('https://api.exchangerate.host/latest?base=USD');
  await db.fxRateSnapshot.create({ base: 'USD', rates, fetchedAt: new Date() });
  await redis.del('fx:latest');
}

@Cron('0 4 * * 1')  // Monday 04:00 UTC
async refreshCatalogPrices() {
  const activeRegions = await db.user.query(`SELECT DISTINCT region FROM users`);

  const topServices = await db.query(`
    SELECT c.id, c.slug, c.name
    FROM catalog_service c
    JOIN subscription s ON s.catalog_service_id = c.id
    GROUP BY c.id
    ORDER BY COUNT(s.id) DESC
    LIMIT 50
  `);

  for (const service of topServices) {
    const knownPlans = await db.catalogPlan.findMany({
      where: { serviceId: service.id },
      select: { planName: true }, distinct: ['planName']
    });
    await queue.add('refreshServicePrices', {
      serviceId: service.id,
      regions: activeRegions,
      knownPlans: knownPlans.map(p => p.planName)
    });
  }
  // Concurrency: 5 workers → ~150 AI calls spread over ~5 minutes
}
```

Lazy refresh on read (in catalog.service.ts):
```ts
async findPlans(serviceId: UUID, region: string) {
  const plans = await db.catalogPlan.findMany({ where: { serviceId, region } });
  const stalest = plans.reduce((m, p) => Math.min(m, p.lastPriceRefreshAt), Infinity);
  const ageDays = (Date.now() - stalest) / 86400_000;

  if (ageDays > 30) {
    await queue.add('refreshServicePrices',
      { serviceId, regions: [region] },
      { jobId: `refresh:${serviceId}:${region}` }  // prevents duplicates
    );
  }
  return plans;
}
```

---

## Mobile Changes

### Onboarding (`app/onboarding.tsx`)

New step inserted between welcome and auth:

```
Title:    Где ты покупаешь подписки?
Subtitle: Это нужно чтобы показать актуальные цены.

Pre-selected via Intl.DateTimeFormat().resolvedOptions().timeZone →
  IANA tz → country mapping (lookup table in src/constants/timezones.ts).

UI:
  [🇰🇿  Казахстан           ✓]    ← default, highlighted
  [ Сменить регион → opens picker ]

On confirm:
  → settingsStore.setRegion('KZ')
  → settingsStore.setDisplayCurrency('KZT')   // default for the region
  → PATCH /users/me { region, displayCurrency }
```

### Settings (`app/(tabs)/settings.tsx`)

Two new rows in Preferences section:
```
Region             🇰🇿 Kazakhstan ›
Display currency   KZT ›
```

- Region row opens a full-screen searchable country picker.
- Currency row opens a picker with the 7 primary currencies first, then ISO list.

When user changes Region:
```
Alert:
  Title:   Change display currency?
  Body:    Show subscriptions in KZT instead of USD?
  Actions: [Change to KZT]  [Keep USD]
```

When user changes either:
```
queryClient.invalidateQueries(['subscriptions']);
queryClient.invalidateQueries(['analytics']);
queryClient.invalidateQueries(['billing', 'me']);
// components re-render with new displayAmount
```

### Stores

```ts
// settingsStore.ts
interface SettingsState {
  region: string          // ISO-3166-1 alpha-2, replaces existing `country`
  displayCurrency: string // ISO-4217, new field (existing `currency` is dropped)
  // ... existing fields
}
```

Migration path: map existing `country` → `region`, `currency` → `displayCurrency` on first load of v1.4.0. Delete old keys in next version.

### Display layer

Primary display switches to `displayAmount + displayCurrency`:
```tsx
<Text style={styles.amount}>
  {formatMoney(sub.displayAmount, sub.displayCurrency, locale)}
</Text>
<Text style={styles.amountOriginal}>
  {formatMoney(sub.amount, sub.currency, locale)} · 1 {sub.currency} = {sub.fxRate} {sub.displayCurrency}
</Text>
```

The secondary "original" line is shown only when currencies differ. When they match, only one line is rendered.

### Add Subscription

In AI lookup sheet, the request passes `user.region`:
```ts
api.post('/ai/lookup', { query, locale: i18n.language, region: user.region });
```

Backend returns plans for that region. When user selects a plan:
```
originalCurrency := plan.currency   // e.g. KZT
amount := plan.price                // e.g. 2990
catalogPlanId := plan.id            // linked to catalog for future refreshes
```

---

## Architecture Flow

```
User opens dashboard
  ↓
GET /subscriptions?displayCurrency=USD
  ↓
SubscriptionService loads subs
  ↓
FxService.getRates() [Redis hit]
  ↓
For each sub: convert(amount, originalCurrency, USD, rates) → displayAmount
  ↓
Response with both amount+currency (historical) and displayAmount+displayCurrency (view)
  ↓
Mobile renders


User types "Netflix" in Add sheet
  ↓
POST /catalog/search { q: 'netflix', region: 'KZ' }
  ↓
CatalogService checks DB for slug "netflix"
  ├─ Hit, fresh    → return plans + iconUrl
  ├─ Hit, stale    → queue refresh job, return stale immediately
  └─ Miss          → acquire Redis lock → AI full-research → persist → return


Weekly cron
  ↓
SELECT top 50 services by subscription count
SELECT DISTINCT region FROM users
  ↓
For each (service, region) batch:
  gpt-4o-mini price-refresh prompt
  Update CatalogPlan.price + lastPriceRefreshAt
  Log diffs for monitoring
```

---

## Error Handling

| Failure | Behavior |
|---------|----------|
| FX API down, no snapshot | 503 on /subscriptions; admin alert; should never happen after first successful fetch |
| FX API down, stale snapshot | Serve stale snapshot, add warning header `X-Fx-Stale: true`; log |
| AI lookup fails (timeout, 5xx) | Return error to client with fallback "Create manually" option |
| AI lookup returns malformed JSON | Retry once with temperature=0; on second fail, surface error, do NOT persist garbage |
| Catalog refresh job fails | Log and skip; next cron picks it up |
| User changes region while offline | Queued PATCH; local settingsStore applied optimistically |
| Concurrent lookups for same slug | Redis lock blocks all but the first; others poll Redis for result (max 20s then fallback) |

---

## Testing

**Unit**
- `FxService.convert` — precision, identity, fallback
- `FxService.getRates` — Redis hit, snapshot fallback, API fail path
- `AiProvider.parseFullResearch` — malformed JSON, missing fields, valid
- `CatalogService.findOrCreate` — dedup by slug+alias, normalization
- `RefreshQueue` — job deduplication via jobId

**Integration**
- `GET /catalog/search` state machine: miss → AI → persist → hit; stale → returns immediately + triggers job
- `GET /subscriptions?displayCurrency=X` — amounts converted, original retained
- Cron `refreshCatalogPrices` with mocked AI — top-N selection, batch sizing, rate limit
- `PATCH /users/me { region }` — response includes suggested currency

**E2E (Maestro)**
- Onboarding: autodetected region confirmed, region changeable
- Settings: change region → dialog → change display currency → all subscriptions recalculated
- Add Subscription: lookup "Netflix" in KZ region → shows KZT plans; save → subscription stored in KZT
- Change display currency → list shows new values without losing originals

---

## Rollout

1. **Migration** — deploy backend with migrations, no user-facing change yet (region/displayCurrency get sane defaults)
2. **FX Service + cron** — deploy and monitor fx snapshots accumulate
3. **Catalog entities + AI prompts** — deploy, keep old `/ai/lookup` endpoint alongside
4. **Mobile v1.4.0** — onboarding region step, Settings additions, display layer updates; backend responds with both amount and displayAmount
5. **Deprecate old /ai/lookup** — after mobile v1.4.0 is >80% adopted, route it to `/catalog/search`

Each step is independently deployable and reversible.

---

## Open Questions

None blocking. Future considerations (out of scope for this spec):

- Per-subscription "override region" (edge case: user traveling)
- Supporting cryptocurrency via separate service
- Machine-learning price predictions vs AI snapshot

---

## References

- Mobile currency state: `src/stores/settingsStore.ts`
- Existing AI lookup: `subradar-backend/src/ai/ai.service.ts:78`
- Existing crons: `subradar-backend/src/analysis/analysis.cron.ts`, `trial-checker.cron.ts`
- Subscription entity: `subradar-backend/src/subscriptions/entities/subscription.entity.ts`
- FX provider docs: https://exchangerate.host/#/docs
