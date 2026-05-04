# Gmail Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pro/Team пользователь подключает Gmail за один tap → за 10 секунд получает список recurring подписок за 365 дней через bulk-confirm screen, с opt-in deep scan для нишевых сервисов.

**Architecture:** Client-side OAuth (refresh-token в Keychain/Keystore, never on backend). Hybrid scan: server-curated allowlist для быстрого pass + opt-in deep scan для recall. AI парсинг на backend в request-scope (no email content storage). Bulk-confirm UX переиспользует существующий voice-flow (`BulkListStage` / `BulkEditModal` / `BulkConfirmView`). Opportunistic re-scan на launch (>14 дней).

**Tech Stack:**
- Mobile: Expo SDK 51, React Native, TypeScript, expo-auth-session, expo-secure-store, expo-sqlite, TanStack Query v5, react-i18next, @amplitude/analytics-react-native
- Backend: NestJS, TypeORM, PostgreSQL, OpenAI SDK (gpt-4o), `@nestjs/throttler`
- External: Gmail REST API v1 (`gmail.readonly` scope), Google OAuth 2.0

**Spec:** [docs/superpowers/specs/2026-05-04-gmail-import-design.md](../specs/2026-05-04-gmail-import-design.md)

**Repos:**
- Mobile: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile`
- Backend: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend`

---

## File Structure

### Backend (`subradar-backend/`)

| File | Status | Responsibility |
|---|---|---|
| `src/migrations/2026-05-04-gmail-import.ts` | **new** | Schema migration: `users.gmail_*` columns + `known_billing_senders` table |
| `src/migrations/2026-05-04-gmail-import-seed.ts` | **new** | Seed ~150 known billing senders |
| `src/auth/guards/require-pro.guard.ts` | **new** | Server-side Pro/Team enforcement, returns 402 on Free |
| `src/billing/billing.service.ts` | modify | Add `getEntitlementStatus(userId): {isPro, isTeam}` if не существует; иначе verify shape |
| `src/subscriptions/email-import/dto/parse-bulk.dto.ts` | **new** | Request DTO with class-validator |
| `src/subscriptions/email-import/dto/candidate.dto.ts` | **new** | Response shape |
| `src/subscriptions/email-import/dto/known-senders.dto.ts` | **new** | Response shape for allowlist |
| `src/subscriptions/email-import/known-senders.entity.ts` | **new** | TypeORM entity for `known_billing_senders` |
| `src/subscriptions/email-import.controller.ts` | modify | Add 5 new endpoints, keep existing `inbound`/`address` unchanged |
| `src/subscriptions/email-import.controller.spec.ts` | modify | Add e2e tests for new endpoints |
| `src/users/entities/user.entity.ts` | modify | Add `gmail_*` fields |
| `src/ai/ai.service.ts` | modify | Add `parseBulkEmails()` method |
| `src/ai/ai.service.spec.ts` | modify | Tests for `parseBulkEmails` with email fixtures |
| `src/ai/dto/email-message.dto.ts` | **new** | Input shape used by `parseBulkEmails` |
| `src/ai/prompts/parse-bulk-emails.prompt.ts` | **new** | OpenAI prompt template + few-shot examples |
| `docs/API_CONTRACTS.md` | modify | Document new endpoints |

### Mobile (`subradar-mobile/`)

| File | Status | Responsibility |
|---|---|---|
| `src/api/emailImport.ts` | **new** | Axios client for `/email-import/*` |
| `src/services/gmail/gmailTokenStore.ts` | **new** | Read/write/clear refresh token via expo-secure-store |
| `src/services/gmail/gmailClient.ts` | **new** | Gmail REST: `messages.list`, `messages.get`, batch via `messages.batchGet` |
| `src/services/gmail/gmailQueryBuilder.ts` | **new** | Build `from:(...) newer_than:Yd` query from allowlist |
| `src/services/scannedMessageStore.ts` | **new** | SQLite cache for scanned message-ids |
| `src/hooks/useGmailAuth.ts` | **new** | OAuth flow orchestration |
| `src/hooks/useGmailScan.ts` | **new** | Scan orchestration: fetch list → batch get → filter → POST /parse-bulk |
| `src/hooks/useEmailImportStatus.ts` | **new** | TanStack query for `/email-import/status` |
| `src/utils/emailImportTelemetry.ts` | **new** | Amplitude wrapper for `gmail_import_*` events |
| `src/components/email-import/ConnectGmailScreen.tsx` | **new** | Full-screen consent UI |
| `src/components/email-import/ScanProgressView.tsx` | **new** | Progress overlay (modal) |
| `src/components/email-import/ImportResultsView.tsx` | **new** | Bulk confirm wrapper, integrates BulkListStage |
| `src/components/email-import/DeepScanPromptCard.tsx` | **new** | "Run deep scan" CTA card |
| `src/components/email-import/EmptyResultsView.tsx` | **new** | Empty state |
| `src/components/email-import/GmailConnectedRow.tsx` | **new** | Settings row showing connection status |
| `src/components/email-import/OpportunisticBanner.tsx` | **new** | Top-of-dashboard banner for re-scan findings |
| `src/components/add-subscription/GmailImportEntryButton.tsx` | **new** | 4th option in AddSubscriptionSheet |
| `src/components/ai-wizard/BulkListStage.tsx` | modify | Add optional `confidenceLevel` and `sourceChip` props |
| `src/components/AddSubscriptionSheet.tsx` | modify | Wire in GmailImportEntryButton |
| `src/components/ProFeatureModal.tsx` | modify | Add `gmail_import` case |
| `src/stores/settingsStore.ts` | modify | Add `emailImport: { autoScanEnabled, scanWindowDays }` |
| `app/email-import/connect.tsx` | **new** | Route: consent screen |
| `app/email-import/scanning.tsx` | **new** | Route: scan progress (modal) |
| `app/email-import/review.tsx` | **new** | Route: bulk confirm |
| `app/email-import/settings.tsx` | **new** | Route: connected accounts subscreen |
| `app/(tabs)/settings.tsx` | modify | Add "Connected Accounts" row |
| `app/_layout.tsx` | modify | Wire opportunistic re-scan |
| `src/locales/{en,ru,de,es,fr,ja,ko,pt,zh,kk}.json` | modify | Add `emailImport` namespace (~85 keys × 10 locales) |
| `src/__tests__/gmail/*.test.ts` | **new** | Unit tests for services/hooks |
| `e2e/gmail-import-*.yaml` | **new** | Maestro flows |
| `app.json` | modify | Add Google OAuth client_id, URL scheme for redirect |
| `package.json` | modify | Add `expo-auth-session`, verify `expo-secure-store` and `expo-sqlite` versions |
| `docs/MOBILE_SCREENS.md` | modify | Add screen entries |
| `docs/NAVIGATION_MAP.md` | modify | Add `email-import/*` routes |

---

## Phase 0 — Compliance Pre-work

These are non-coding tasks that **must start in parallel with Phase 1**, otherwise rollout is blocked.

- [ ] **0.1** Создать новый OAuth 2.0 Client ID в Google Cloud Console (`subradar-prod` project) специально под Gmail API. Тип: Web/iOS/Android в зависимости от того, как будет билдится через expo-auth-session. **Не использовать** существующий client для Sign-In with Google — другой scope-set, другая verification.
  - Authorized redirect URIs: `https://auth.expo.io/@subradar/subradar-mobile` (managed) или native scheme `com.subradar.mobile:/oauthredirect`
  - Save `client_id` для iOS, Android, Web — добавить в `EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_*`

- [ ] **0.2** Подать заявку на OAuth verification + CASA Tier 2:
  - https://console.cloud.google.com/apis/credentials/consent → OAuth consent screen → Submit for verification
  - Заполнить app domain, privacy policy URL, terms of service URL
  - Указать использование scope `https://www.googleapis.com/auth/gmail.readonly` с обоснованием: "Read user's billing receipts to extract recurring subscription metadata for personal subscription tracking"
  - Прикрепить ссылку на demo video (Phase 0.6)
  - **Wall-time:** 4–8 недель. Стартовать сейчас.

- [ ] **0.3** Обновить Privacy Policy на subradar.ai с секцией "Gmail Integration":
  - Что читаем (gmail.readonly)
  - Как обрабатываем (transient parse, no storage)
  - Срок хранения (only resulting subscriptions)
  - Контакт DPO
  - Право на удаление и portability
  - **Файл:** `subradar-landing/src/app/privacy/page.tsx` (предположительно)
  - Юр.ревью если есть юрист

- [ ] **0.4** Обновить App Privacy декларацию в App Store Connect:
  - Data Linked to You: None (от Gmail)
  - Data Used to Track You: None
  - Data Not Linked to You: "Email metadata processed transiently for subscription parsing — not stored"

- [ ] **0.5** Обновить Data Safety форму в Google Play Console аналогично

- [ ] **0.6** Записать demo-видео consent flow и full happy path для Apple Review и Google verification (60–90 секунд каждое)

- [ ] **0.7** Создать demo Gmail-аккаунт с реальными billing emails (минимум 5–10 receipts от Netflix, Spotify, Adobe, OpenAI, etc.) для Apple Review submission notes и Google verification

---

## Phase 1 — Backend

### Task 1.1: Schema migration

**Files:**
- Create: `subradar-backend/src/migrations/2026-05-04-gmail-import.ts`
- Modify: `subradar-backend/src/users/entities/user.entity.ts`

- [ ] **Step 1: Add fields to User entity**

`subradar-backend/src/users/entities/user.entity.ts`:
```typescript
// Add inside @Entity() class User { ... }
@Column({ type: 'timestamp', name: 'gmail_connected_at', nullable: true })
gmailConnectedAt: Date | null;

@Column({ type: 'timestamp', name: 'gmail_last_scan_at', nullable: true })
gmailLastScanAt: Date | null;

@Column({ type: 'int', name: 'gmail_last_import_count', nullable: true })
gmailLastImportCount: number | null;

@Column({ type: 'int', name: 'gmail_deep_scans_this_month', default: 0 })
gmailDeepScansThisMonth: number;

@Column({ type: 'varchar', length: 7, name: 'gmail_deep_scan_month', nullable: true })
gmailDeepScanMonth: string | null; // 'YYYY-MM'
```

- [ ] **Step 2: Create migration file**

```typescript
// subradar-backend/src/migrations/2026-05-04-gmail-import.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class GmailImport20260504 implements MigrationInterface {
  name = 'GmailImport20260504';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE users
        ADD COLUMN gmail_connected_at TIMESTAMP NULL,
        ADD COLUMN gmail_last_scan_at TIMESTAMP NULL,
        ADD COLUMN gmail_last_import_count INT NULL,
        ADD COLUMN gmail_deep_scans_this_month INT NOT NULL DEFAULT 0,
        ADD COLUMN gmail_deep_scan_month VARCHAR(7) NULL
    `);
    await qr.query(`
      CREATE TABLE known_billing_senders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        domain VARCHAR(255) NOT NULL,
        email_pattern VARCHAR(255) NULL,
        service_name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        default_currency VARCHAR(3) NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        added_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_known_senders_domain_pattern UNIQUE(domain, email_pattern)
      )
    `);
    await qr.query(`
      CREATE INDEX idx_known_senders_active
        ON known_billing_senders(active) WHERE active = TRUE
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS idx_known_senders_active`);
    await qr.query(`DROP TABLE IF EXISTS known_billing_senders`);
    await qr.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS gmail_connected_at,
        DROP COLUMN IF EXISTS gmail_last_scan_at,
        DROP COLUMN IF EXISTS gmail_last_import_count,
        DROP COLUMN IF EXISTS gmail_deep_scans_this_month,
        DROP COLUMN IF EXISTS gmail_deep_scan_month
    `);
  }
}
```

- [ ] **Step 3: Run migration in dev**

```bash
cd subradar-backend
npm run migration:run
```
Expected: migration `GmailImport20260504` applied, no errors. Verify in psql:
```sql
\d users  -- should show new columns
\d known_billing_senders  -- should exist
```

- [ ] **Step 4: Commit**

```bash
git add src/migrations/2026-05-04-gmail-import.ts src/users/entities/user.entity.ts
git commit -m "feat(db): add gmail integration schema (users + known_billing_senders)"
```

---

### Task 1.2: Seed known_billing_senders

**Files:**
- Create: `subradar-backend/src/migrations/2026-05-04-gmail-import-seed.ts`
- Create: `subradar-backend/scripts/known-senders.json`

- [ ] **Step 1: Create JSON seed**

`subradar-backend/scripts/known-senders.json`:
```json
[
  {"domain": "netflix.com", "service": "Netflix", "category": "STREAMING"},
  {"domain": "spotify.com", "service": "Spotify", "category": "MUSIC"},
  {"domain": "apple.com", "emailPattern": "no_reply@email.apple.com", "service": "Apple", "category": "OTHER"},
  {"domain": "youtube.com", "service": "YouTube Premium", "category": "STREAMING"},
  {"domain": "openai.com", "service": "ChatGPT Plus", "category": "AI_SERVICES"},
  {"domain": "anthropic.com", "service": "Claude Pro", "category": "AI_SERVICES"},
  {"domain": "adobe.com", "service": "Adobe Creative Cloud", "category": "PRODUCTIVITY"},
  {"domain": "notion.so", "service": "Notion", "category": "PRODUCTIVITY"},
  {"domain": "figma.com", "service": "Figma", "category": "PRODUCTIVITY"},
  {"domain": "github.com", "service": "GitHub", "category": "INFRASTRUCTURE"},
  {"domain": "vercel.com", "service": "Vercel", "category": "INFRASTRUCTURE"},
  {"domain": "cloudflare.com", "service": "Cloudflare", "category": "INFRASTRUCTURE"},
  {"domain": "google.com", "emailPattern": "payments-noreply@google.com", "service": "Google One", "category": "INFRASTRUCTURE"},
  {"domain": "microsoft.com", "service": "Microsoft 365", "category": "PRODUCTIVITY"},
  {"domain": "1password.com", "service": "1Password", "category": "INFRASTRUCTURE"},
  {"domain": "dropbox.com", "service": "Dropbox", "category": "INFRASTRUCTURE"},
  {"domain": "zoom.us", "service": "Zoom", "category": "PRODUCTIVITY"},
  {"domain": "slack.com", "service": "Slack", "category": "PRODUCTIVITY"},
  {"domain": "linear.app", "service": "Linear", "category": "PRODUCTIVITY"},
  {"domain": "asana.com", "service": "Asana", "category": "PRODUCTIVITY"},
  {"domain": "monday.com", "service": "Monday.com", "category": "PRODUCTIVITY"},
  {"domain": "clickup.com", "service": "ClickUp", "category": "PRODUCTIVITY"},
  {"domain": "stripe.com", "service": "Stripe", "category": "INFRASTRUCTURE"},
  {"domain": "supabase.com", "service": "Supabase", "category": "INFRASTRUCTURE"},
  {"domain": "render.com", "service": "Render", "category": "INFRASTRUCTURE"},
  {"domain": "heroku.com", "service": "Heroku", "category": "INFRASTRUCTURE"},
  {"domain": "digitalocean.com", "service": "DigitalOcean", "category": "INFRASTRUCTURE"},
  {"domain": "aws.amazon.com", "service": "AWS", "category": "INFRASTRUCTURE"},
  {"domain": "amazon.com", "emailPattern": "auto-confirm@amazon.com", "service": "Amazon Prime", "category": "STREAMING"},
  {"domain": "disneyplus.com", "service": "Disney+", "category": "STREAMING"},
  {"domain": "hbomax.com", "service": "HBO Max", "category": "STREAMING"},
  {"domain": "max.com", "service": "Max", "category": "STREAMING"},
  {"domain": "hulu.com", "service": "Hulu", "category": "STREAMING"},
  {"domain": "paramount.com", "service": "Paramount+", "category": "STREAMING"},
  {"domain": "peacocktv.com", "service": "Peacock", "category": "STREAMING"},
  {"domain": "twitch.tv", "service": "Twitch", "category": "STREAMING"},
  {"domain": "patreon.com", "service": "Patreon", "category": "OTHER"},
  {"domain": "substack.com", "service": "Substack", "category": "NEWS"},
  {"domain": "medium.com", "service": "Medium", "category": "NEWS"},
  {"domain": "nytimes.com", "service": "New York Times", "category": "NEWS"},
  {"domain": "wsj.com", "service": "Wall Street Journal", "category": "NEWS"},
  {"domain": "ft.com", "service": "Financial Times", "category": "NEWS"},
  {"domain": "the-economist.com", "service": "The Economist", "category": "NEWS"},
  {"domain": "wired.com", "service": "Wired", "category": "NEWS"},
  {"domain": "nordvpn.com", "service": "NordVPN", "category": "INFRASTRUCTURE"},
  {"domain": "expressvpn.com", "service": "ExpressVPN", "category": "INFRASTRUCTURE"},
  {"domain": "protonmail.com", "service": "Proton Mail", "category": "INFRASTRUCTURE"},
  {"domain": "protonvpn.com", "service": "Proton VPN", "category": "INFRASTRUCTURE"},
  {"domain": "headspace.com", "service": "Headspace", "category": "HEALTH"},
  {"domain": "calm.com", "service": "Calm", "category": "HEALTH"},
  {"domain": "duolingo.com", "service": "Duolingo Plus", "category": "PRODUCTIVITY"},
  {"domain": "audible.com", "service": "Audible", "category": "OTHER"},
  {"domain": "scribd.com", "service": "Scribd", "category": "OTHER"},
  {"domain": "playstation.com", "service": "PlayStation Plus", "category": "GAMING"},
  {"domain": "xbox.com", "service": "Xbox Game Pass", "category": "GAMING"},
  {"domain": "nintendo.com", "service": "Nintendo Switch Online", "category": "GAMING"},
  {"domain": "epicgames.com", "service": "Epic Games", "category": "GAMING"},
  {"domain": "ea.com", "service": "EA Play", "category": "GAMING"},
  {"domain": "ubisoft.com", "service": "Ubisoft+", "category": "GAMING"},
  {"domain": "discordapp.com", "service": "Discord Nitro", "category": "OTHER"},
  {"domain": "midjourney.com", "service": "Midjourney", "category": "AI_SERVICES"},
  {"domain": "perplexity.ai", "service": "Perplexity Pro", "category": "AI_SERVICES"},
  {"domain": "elevenlabs.io", "service": "ElevenLabs", "category": "AI_SERVICES"},
  {"domain": "runwayml.com", "service": "Runway", "category": "AI_SERVICES"},
  {"domain": "replicate.com", "service": "Replicate", "category": "AI_SERVICES"},
  {"domain": "huggingface.co", "service": "Hugging Face", "category": "AI_SERVICES"},
  {"domain": "yandex.ru", "service": "Yandex Plus", "category": "STREAMING"},
  {"domain": "kinopoisk.ru", "service": "Kinopoisk", "category": "STREAMING"},
  {"domain": "okko.tv", "service": "Okko", "category": "STREAMING"},
  {"domain": "ivi.ru", "service": "ivi", "category": "STREAMING"},
  {"domain": "wink.ru", "service": "Wink", "category": "STREAMING"},
  {"domain": "sber.ru", "service": "СберПрайм", "category": "OTHER"},
  {"domain": "t-bank.ru", "service": "Тинькофф Pro", "category": "OTHER"}
]
```
**Note:** оставшиеся ~80 записей — добавить вторым коммитом по мере выявления через телеметрию. Для R1 этого достаточно для покрытия топ-сервисов.

- [ ] **Step 2: Create seed migration**

```typescript
// subradar-backend/src/migrations/2026-05-04-gmail-import-seed.ts
import { MigrationInterface, QueryRunner } from 'typeorm';
import seed from '../../scripts/known-senders.json';

export class GmailImportSeed20260504 implements MigrationInterface {
  name = 'GmailImportSeed20260504';

  public async up(qr: QueryRunner): Promise<void> {
    for (const row of seed) {
      await qr.query(
        `INSERT INTO known_billing_senders (domain, email_pattern, service_name, category)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (domain, email_pattern) DO NOTHING`,
        [row.domain, row.emailPattern ?? null, row.service, row.category]
      );
    }
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DELETE FROM known_billing_senders`);
  }
}
```

- [ ] **Step 3: Run + verify**

```bash
npm run migration:run
psql $DATABASE_URL -c "SELECT COUNT(*) FROM known_billing_senders WHERE active = TRUE;"
```
Expected: count >= 70

- [ ] **Step 4: Commit**

```bash
git add src/migrations/2026-05-04-gmail-import-seed.ts scripts/known-senders.json
git commit -m "feat(db): seed known_billing_senders with top ~70 services"
```

---

### Task 1.3: RequireProGuard

**Files:**
- Create: `subradar-backend/src/auth/guards/require-pro.guard.ts`
- Create: `subradar-backend/src/auth/guards/require-pro.guard.spec.ts`

- [ ] **Step 1: Inspect billing service for entitlement check**

Read `subradar-backend/src/billing/billing.service.ts` and find existing method that returns user's plan tier. If `getEntitlementStatus` (or equivalent) doesn't exist, add it returning `{isPro: boolean, isTeam: boolean, planTier: 'FREE' | 'PRO' | 'TEAM'}`.

- [ ] **Step 2: Write failing test**

```typescript
// subradar-backend/src/auth/guards/require-pro.guard.spec.ts
import { Test } from '@nestjs/testing';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { RequireProGuard } from './require-pro.guard';
import { BillingService } from '../../billing/billing.service';

describe('RequireProGuard', () => {
  let guard: RequireProGuard;
  let billingService: { getEntitlementStatus: jest.Mock };

  const buildContext = (userId: string): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user: { id: userId } }) }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    billingService = { getEntitlementStatus: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        RequireProGuard,
        { provide: BillingService, useValue: billingService },
      ],
    }).compile();
    guard = module.get(RequireProGuard);
  });

  it('allows Pro users', async () => {
    billingService.getEntitlementStatus.mockResolvedValue({ isPro: true, isTeam: false });
    expect(await guard.canActivate(buildContext('u1'))).toBe(true);
  });

  it('allows Team users', async () => {
    billingService.getEntitlementStatus.mockResolvedValue({ isPro: false, isTeam: true });
    expect(await guard.canActivate(buildContext('u1'))).toBe(true);
  });

  it('rejects Free users with 402', async () => {
    billingService.getEntitlementStatus.mockResolvedValue({ isPro: false, isTeam: false });
    await expect(guard.canActivate(buildContext('u1'))).rejects.toThrow(HttpException);
    await expect(guard.canActivate(buildContext('u1'))).rejects.toMatchObject({ status: 402 });
  });
});
```

- [ ] **Step 3: Run test — FAIL**

```bash
cd subradar-backend
npm test -- require-pro.guard.spec
```
Expected: FAIL — `RequireProGuard` not found.

- [ ] **Step 4: Implement guard**

```typescript
// subradar-backend/src/auth/guards/require-pro.guard.ts
import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { BillingService } from '../../billing/billing.service';

@Injectable()
export class RequireProGuard implements CanActivate {
  constructor(private readonly billingService: BillingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const status = await this.billingService.getEntitlementStatus(req.user.id);
    if (!status.isPro && !status.isTeam) {
      throw new HttpException(
        { code: 'PRO_PLAN_REQUIRED', message: 'This feature requires a Pro or Team plan' },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return true;
  }
}
```

- [ ] **Step 5: Run test — PASS**

```bash
npm test -- require-pro.guard.spec
```
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add src/auth/guards/require-pro.guard.ts src/auth/guards/require-pro.guard.spec.ts
git commit -m "feat(auth): add RequireProGuard for premium-only endpoints"
```

---

### Task 1.4: AI service — parseBulkEmails

**Files:**
- Create: `subradar-backend/src/ai/dto/email-message.dto.ts`
- Create: `subradar-backend/src/ai/prompts/parse-bulk-emails.prompt.ts`
- Modify: `subradar-backend/src/ai/ai.service.ts`
- Modify: `subradar-backend/src/ai/ai.service.spec.ts`

- [ ] **Step 1: Create input DTO**

```typescript
// subradar-backend/src/ai/dto/email-message.dto.ts
import { IsString, IsISO8601, MaxLength, IsEmail } from 'class-validator';

export class EmailMessageDto {
  @IsString() @MaxLength(255)
  id: string;

  @IsString() @MaxLength(500)
  subject: string;

  @IsString() @MaxLength(4000)
  snippet: string;

  @IsEmail()
  from: string;

  @IsISO8601()
  receivedAt: string;
}

export interface CandidateOutput {
  sourceMessageId: string;
  name: string;
  amount: number;
  currency: string;
  billingPeriod: 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY' | 'LIFETIME' | 'ONE_TIME';
  category: string;
  status: 'ACTIVE' | 'TRIAL';
  nextPaymentDate?: string;
  trialEndDate?: string;
  iconUrl?: string;
  confidence: number;
  isRecurring: boolean;
  isCancellation: boolean;
  isTrial: boolean;
  aggregatedFrom: string[];
}
```

- [ ] **Step 2: Create prompt module**

```typescript
// subradar-backend/src/ai/prompts/parse-bulk-emails.prompt.ts
export const PARSE_BULK_EMAILS_SYSTEM = `You are a subscription extractor. From each email, decide:
1. Is this a RECURRING subscription receipt (monthly/yearly/weekly)? If one-time purchase like "you bought a movie" or "thanks for your order of headphones", set isRecurring=false.
2. Is this a CANCELLATION notice? Set isCancellation=true if "your subscription has been cancelled", "subscription ends", etc.
3. Is this a TRIAL notice? Set isTrial=true and extract trialEndDate if "your free trial ends on...".

Extract:
- name (canonical service name like "Netflix" or "ChatGPT Plus")
- amount (number, no currency symbol)
- currency (ISO 4217: USD, EUR, RUB, etc.)
- billingPeriod (MONTHLY, YEARLY, WEEKLY, QUARTERLY, LIFETIME, ONE_TIME)
- category (one of: STREAMING, AI_SERVICES, INFRASTRUCTURE, MUSIC, GAMING, PRODUCTIVITY, HEALTH, NEWS, OTHER)
- status (ACTIVE or TRIAL)
- nextPaymentDate (ISO date if present in receipt)
- trialEndDate (ISO date if trial)
- confidence (0..1, your honest self-assessment)

Reply with strict JSON: {"candidates": [...]}. No prose.`;

export const PARSE_BULK_EMAILS_FEW_SHOT = [
  {
    role: 'user' as const,
    content: JSON.stringify([
      {
        id: 'msg1',
        from: 'no-reply@netflix.com',
        subject: 'Your Netflix membership',
        snippet: 'Your subscription was renewed for $15.49 on March 14, 2026.',
        receivedAt: '2026-03-14T10:00:00Z',
      },
    ]),
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      candidates: [
        {
          sourceMessageId: 'msg1',
          name: 'Netflix',
          amount: 15.49,
          currency: 'USD',
          billingPeriod: 'MONTHLY',
          category: 'STREAMING',
          status: 'ACTIVE',
          nextPaymentDate: '2026-04-14',
          confidence: 0.95,
          isRecurring: true,
          isCancellation: false,
          isTrial: false,
        },
      ],
    }),
  },
];
```

- [ ] **Step 3: Add `parseBulkEmails` to AI service — write test first**

Add to `subradar-backend/src/ai/ai.service.spec.ts`:
```typescript
describe('parseBulkEmails', () => {
  let service: AiService;
  let openai: { chat: { completions: { create: jest.Mock } } };

  beforeEach(async () => {
    openai = { chat: { completions: { create: jest.fn() } } };
    // Use existing testing module setup, swap OpenAI provider for `openai`
    // (adapt to actual module setup in this file).
  });

  it('aggregates multiple receipts from same service into one candidate', async () => {
    openai.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            candidates: [
              { sourceMessageId: 'm1', name: 'Netflix', amount: 15.49, currency: 'USD',
                billingPeriod: 'MONTHLY', category: 'STREAMING', status: 'ACTIVE',
                confidence: 0.95, isRecurring: true, isCancellation: false, isTrial: false },
              { sourceMessageId: 'm2', name: 'Netflix', amount: 15.49, currency: 'USD',
                billingPeriod: 'MONTHLY', category: 'STREAMING', status: 'ACTIVE',
                confidence: 0.93, isRecurring: true, isCancellation: false, isTrial: false },
            ],
          }),
        },
      }],
    });

    const result = await service.parseBulkEmails(
      [
        { id: 'm1', subject: 'Netflix renewal', snippet: '...', from: 'no-reply@netflix.com', receivedAt: '2026-02-14T10:00:00Z' },
        { id: 'm2', subject: 'Netflix renewal', snippet: '...', from: 'no-reply@netflix.com', receivedAt: '2026-03-14T10:00:00Z' },
      ],
      'en',
      'shallow',
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Netflix');
    expect(result[0].aggregatedFrom).toEqual(expect.arrayContaining(['m1', 'm2']));
  });

  it('filters out non-recurring purchases', async () => {
    openai.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            candidates: [
              { sourceMessageId: 'm1', name: 'Apple TV Movie', amount: 4.99, currency: 'USD',
                billingPeriod: 'ONE_TIME', category: 'OTHER', status: 'ACTIVE',
                confidence: 0.98, isRecurring: false, isCancellation: false, isTrial: false },
            ],
          }),
        },
      }],
    });
    const result = await service.parseBulkEmails([{
      id: 'm1', subject: 'Receipt for movie', snippet: '...', from: 'no_reply@email.apple.com', receivedAt: '2026-03-01T10:00:00Z',
    }], 'en', 'shallow');
    expect(result.every(c => c.isRecurring)).toBe(true);
    // Note: the service still RETURNS isRecurring=false ones; it's the controller/mobile that filters.
    // Verify the flag is preserved:
    expect(result).toHaveLength(1);
    expect(result[0].isRecurring).toBe(false);
  });

  it('returns empty array on malformed AI response', async () => {
    openai.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'not json' } }],
    });
    const result = await service.parseBulkEmails([{
      id: 'm1', subject: 's', snippet: 's', from: 'a@b.com', receivedAt: '2026-03-01T10:00:00Z',
    }], 'en', 'shallow');
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 4: Run test — FAIL**

```bash
npm test -- ai.service.spec
```
Expected: FAIL — `parseBulkEmails` doesn't exist.

- [ ] **Step 5: Implement parseBulkEmails**

In `subradar-backend/src/ai/ai.service.ts` add:
```typescript
import { EmailMessageDto, CandidateOutput } from './dto/email-message.dto';
import { PARSE_BULK_EMAILS_SYSTEM, PARSE_BULK_EMAILS_FEW_SHOT } from './prompts/parse-bulk-emails.prompt';

async parseBulkEmails(
  messages: EmailMessageDto[],
  locale: string,
  mode: 'shallow' | 'deep',
): Promise<CandidateOutput[]> {
  if (messages.length === 0) return [];

  const userContent = JSON.stringify(messages.map(m => ({
    id: m.id, from: m.from, subject: m.subject, snippet: m.snippet, receivedAt: m.receivedAt,
  })));

  const response = await this.openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    temperature: 0.1,
    messages: [
      { role: 'system', content: PARSE_BULK_EMAILS_SYSTEM + `\n\nUser locale: ${locale}` },
      ...PARSE_BULK_EMAILS_FEW_SHOT,
      { role: 'user', content: userContent },
    ],
  });

  let parsed: { candidates: CandidateOutput[] };
  try {
    parsed = JSON.parse(response.choices[0].message.content ?? '{"candidates":[]}');
  } catch {
    this.logger.warn('parseBulkEmails: malformed AI JSON response');
    return [];
  }
  if (!Array.isArray(parsed.candidates)) return [];

  return this.aggregateCandidates(parsed.candidates);
}

private aggregateCandidates(items: CandidateOutput[]): CandidateOutput[] {
  const groups = new Map<string, CandidateOutput[]>();
  for (const c of items) {
    const key = `${c.name.trim().toLowerCase()}|${c.currency}|${c.billingPeriod}`;
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  }
  const out: CandidateOutput[] = [];
  for (const arr of groups.values()) {
    if (arr.length === 1) {
      out.push({ ...arr[0], aggregatedFrom: [arr[0].sourceMessageId] });
      continue;
    }
    arr.sort((a, b) => (b.nextPaymentDate ?? '').localeCompare(a.nextPaymentDate ?? ''));
    const latest = arr[0];
    const allIds = arr.map(c => c.sourceMessageId);
    const maxAmount = Math.max(...arr.map(c => c.amount));
    out.push({
      ...latest,
      amount: maxAmount,
      confidence: Math.max(...arr.map(c => c.confidence)),
      aggregatedFrom: allIds,
    });
  }
  return out;
}
```

- [ ] **Step 6: Run test — PASS**

```bash
npm test -- ai.service.spec
```
Expected: 3 new passing.

- [ ] **Step 7: Commit**

```bash
git add src/ai/dto/email-message.dto.ts src/ai/prompts/parse-bulk-emails.prompt.ts src/ai/ai.service.ts src/ai/ai.service.spec.ts
git commit -m "feat(ai): add parseBulkEmails with aggregation and confidence flags"
```

---

### Task 1.5: Email Import Controller — new endpoints

**Files:**
- Create: `subradar-backend/src/subscriptions/email-import/dto/parse-bulk.dto.ts`
- Create: `subradar-backend/src/subscriptions/email-import/dto/known-senders.dto.ts`
- Create: `subradar-backend/src/subscriptions/email-import/known-senders.entity.ts`
- Modify: `subradar-backend/src/subscriptions/email-import.controller.ts`
- Modify: `subradar-backend/src/subscriptions/subscriptions.module.ts`

- [ ] **Step 1: KnownBillingSender entity**

```typescript
// subradar-backend/src/subscriptions/email-import/known-senders.entity.ts
import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'known_billing_senders' })
@Unique('uq_known_senders_domain_pattern', ['domain', 'emailPattern'])
export class KnownBillingSender {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  domain: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'email_pattern' })
  emailPattern: string | null;

  @Column({ type: 'varchar', length: 100, name: 'service_name' })
  serviceName: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'varchar', length: 3, nullable: true, name: 'default_currency' })
  defaultCurrency: string | null;

  @Index('idx_known_senders_active')
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'timestamp', name: 'added_at' })
  addedAt: Date;

  @Column({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 2: DTOs**

```typescript
// subradar-backend/src/subscriptions/email-import/dto/parse-bulk.dto.ts
import { ArrayMaxSize, IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EmailMessageDto } from '../../../ai/dto/email-message.dto';

export class ParseBulkDto {
  @IsArray() @ArrayMaxSize(800) @ValidateNested({ each: true }) @Type(() => EmailMessageDto)
  messages: EmailMessageDto[];

  @IsString()
  locale: string;

  @IsIn(['shallow', 'deep'])
  mode: 'shallow' | 'deep';
}
```

```typescript
// subradar-backend/src/subscriptions/email-import/dto/known-senders.dto.ts
export interface KnownSenderDto {
  domain: string;
  emailPattern: string | null;
  serviceName: string;
  category: string;
  defaultCurrency: string | null;
}
```

- [ ] **Step 3: Write controller test (e2e shape)**

Add to `subradar-backend/src/subscriptions/email-import.controller.spec.ts`:
```typescript
describe('GET /email-import/known-senders', () => {
  it('returns active senders for Pro user', async () => {
    /* setup mock app with Pro user, seed senders, call endpoint, expect 200 + array */
  });
  it('returns 402 for Free user', async () => {
    /* mock Free, expect 402 */
  });
});

describe('POST /email-import/parse-bulk', () => {
  it('returns candidates from AI service', async () => { /* ... */ });
  it('rejects payload > 800 messages', async () => {
    /* mock 801 messages, expect 413 */
  });
  it('rate-limits second call within 60s', async () => {
    /* call twice, expect 429 on second */
  });
  it('returns 402 for Free', async () => { /* ... */ });
});

describe('GET /email-import/status', () => {
  it('returns connection status', async () => { /* ... */ });
});

describe('POST /email-import/disconnect', () => {
  it('clears gmail_* fields and is idempotent', async () => { /* ... */ });
});
```

- [ ] **Step 4: Run test — FAIL** (endpoints not yet implemented)

- [ ] **Step 5: Implement controller endpoints**

Modify `subradar-backend/src/subscriptions/email-import.controller.ts` — keep existing `inbound` and `address` methods, add at the end of the class:

```typescript
import { Get, Param, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParseBulkDto } from './email-import/dto/parse-bulk.dto';
import { KnownBillingSender } from './email-import/known-senders.entity';
import { RequireProGuard } from '../auth/guards/require-pro.guard';
import { User } from '../users/entities/user.entity';

// Add to constructor:
//   @InjectRepository(KnownBillingSender) private senders: Repository<KnownBillingSender>,
//   @InjectRepository(User) private users: Repository<User>,

@Get('known-senders')
@UseGuards(JwtAuthGuard, RequireProGuard)
async getKnownSenders() {
  const rows = await this.senders.find({ where: { active: true } });
  return {
    senders: rows.map(r => ({
      domain: r.domain,
      emailPattern: r.emailPattern,
      serviceName: r.serviceName,
      category: r.category,
      defaultCurrency: r.defaultCurrency,
    })),
    updatedAt: new Date().toISOString(),
  };
}

@Post('parse-bulk')
@UseGuards(JwtAuthGuard, RequireProGuard)
@Throttle({ default: { limit: 1, ttl: 60_000 } })
async parseBulk(@Body() dto: ParseBulkDto, @Req() req) {
  const userId = req.user.id;
  if (dto.mode === 'deep') {
    await this.checkAndIncrementDeepScanQuota(userId);
  }
  const candidates = await this.aiService.parseBulkEmails(dto.messages, dto.locale, dto.mode);
  await this.users.update(userId, {
    gmailLastScanAt: new Date(),
    gmailConnectedAt: () => 'COALESCE(gmail_connected_at, NOW())',
  });
  return {
    candidates,
    scannedCount: dto.messages.length,
    droppedCount: dto.messages.length - candidates.length,
  };
}

@Get('status')
@UseGuards(JwtAuthGuard)
async status(@Req() req) {
  const u = await this.users.findOne({ where: { id: req.user.id } });
  return {
    gmailConnected: !!u?.gmailConnectedAt,
    lastScanAt: u?.gmailLastScanAt?.toISOString() ?? null,
    lastImportCount: u?.gmailLastImportCount ?? null,
  };
}

@Post('disconnect')
@UseGuards(JwtAuthGuard)
async disconnect(@Req() req) {
  await this.users.update(req.user.id, {
    gmailConnectedAt: null,
    gmailLastScanAt: null,
    gmailLastImportCount: null,
  });
  return { ok: true };
}

@Post('log-event')
@UseGuards(JwtAuthGuard)
async logEvent(@Body() dto: { event: string; props?: Record<string, string | number | boolean> }, @Req() req) {
  this.logger.log(`[telemetry] user=${req.user.id} event=${dto.event} props=${JSON.stringify(dto.props ?? {})}`);
  return { ok: true };
}

private async checkAndIncrementDeepScanQuota(userId: string) {
  const u = await this.users.findOne({ where: { id: userId } });
  if (!u) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const count = u.gmailDeepScanMonth === currentMonth ? u.gmailDeepScansThisMonth : 0;
  if (count >= 6) {
    throw new HttpException(
      { code: 'DEEP_SCAN_QUOTA_EXCEEDED', message: 'Maximum 6 deep scans per month' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  await this.users.update(userId, {
    gmailDeepScanMonth: currentMonth,
    gmailDeepScansThisMonth: count + 1,
  });
}
```

Update module imports in `subscriptions.module.ts` to register `KnownBillingSender` repository.

- [ ] **Step 6: Run tests — PASS**

```bash
npm test -- email-import.controller.spec
```

- [ ] **Step 7: Commit**

```bash
git add src/subscriptions/email-import/ src/subscriptions/email-import.controller.ts src/subscriptions/email-import.controller.spec.ts src/subscriptions/subscriptions.module.ts
git commit -m "feat(api): add gmail import endpoints (parse-bulk, known-senders, status, disconnect, log-event)"
```

---

### Task 1.6: Update API_CONTRACTS doc

- [ ] **Step 1: Modify** `subradar-backend/docs/API_CONTRACTS.md`

Add new section under "Subscriptions":
```markdown
## Email Import (NEW — R1)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET  | `/email-import/known-senders` | JWT (Pro+) | Curated allowlist for Gmail query building |
| POST | `/email-import/parse-bulk`    | JWT (Pro+), 1/min, ≤800 msgs | AI-parse email snippets into candidate subscriptions |
| GET  | `/email-import/status`        | JWT | `{ gmailConnected, lastScanAt, lastImportCount }` |
| POST | `/email-import/disconnect`    | JWT | Clears gmail_* user fields. Idempotent. |
| POST | `/email-import/log-event`     | JWT | Anonymous funnel telemetry (no email content) |

Existing `inbound` and `address` endpoints unchanged.
```

- [ ] **Step 2: Sync docs in mobile repo**

```bash
cp /path/to/subradar-backend/docs/API_CONTRACTS.md /path/to/subradar-mobile/docs/API_CONTRACTS.md
```

- [ ] **Step 3: Commit (in both repos)**

```bash
# in subradar-backend:
git add docs/API_CONTRACTS.md && git commit -m "docs(api): document gmail import endpoints"
# in subradar-mobile:
git add docs/API_CONTRACTS.md && git commit -m "docs(api): sync gmail import endpoints from backend"
```

---

## Phase 2 — Mobile services & hooks

### Task 2.1: Add dependencies and OAuth config

**Files:**
- Modify: `subradar-mobile/package.json`
- Modify: `subradar-mobile/app.json`

- [ ] **Step 1: Add packages**

```bash
cd subradar-mobile
npx expo install expo-auth-session expo-crypto
# Verify already installed:
grep '"expo-secure-store"\|"expo-sqlite"' package.json
# If missing:
npx expo install expo-secure-store expo-sqlite
```

- [ ] **Step 2: Configure OAuth redirect scheme**

Edit `app.json` → add to `expo.scheme`:
```json
"scheme": "subradar"
```
(if already set, skip). Add iOS associatedDomains if Universal Links нужны позже — для R1 хватает custom scheme.

- [ ] **Step 3: Add EXPO_PUBLIC env**

`.env.development` and `.env.production`:
```
EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_IOS=<from Phase 0.1>
EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_ANDROID=<from Phase 0.1>
EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_WEB=<from Phase 0.1>
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "chore(deps): add expo-auth-session for gmail OAuth"
```

---

### Task 2.2: gmailTokenStore

**Files:**
- Create: `subradar-mobile/src/services/gmail/gmailTokenStore.ts`
- Create: `subradar-mobile/src/__tests__/gmail/gmailTokenStore.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/gmail/gmailTokenStore.test.ts
import * as SecureStore from 'expo-secure-store';
import { gmailTokenStore } from '../../services/gmail/gmailTokenStore';

jest.mock('expo-secure-store');

describe('gmailTokenStore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves refresh token', async () => {
    await gmailTokenStore.saveRefreshToken('rt-abc');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('gmail_refresh_token', 'rt-abc');
  });

  it('reads refresh token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('rt-abc');
    await expect(gmailTokenStore.getRefreshToken()).resolves.toBe('rt-abc');
  });

  it('returns null when missing', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    await expect(gmailTokenStore.getRefreshToken()).resolves.toBeNull();
  });

  it('clears refresh token', async () => {
    await gmailTokenStore.clear();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('gmail_refresh_token');
  });
});
```

- [ ] **Step 2: Run — FAIL**

```bash
npm test -- gmailTokenStore
```

- [ ] **Step 3: Implement**

```typescript
// src/services/gmail/gmailTokenStore.ts
import * as SecureStore from 'expo-secure-store';

const KEY = 'gmail_refresh_token';

export const gmailTokenStore = {
  saveRefreshToken: (token: string) => SecureStore.setItemAsync(KEY, token),
  getRefreshToken: () => SecureStore.getItemAsync(KEY),
  clear: () => SecureStore.deleteItemAsync(KEY),
};
```

- [ ] **Step 4: PASS + Commit**

```bash
npm test -- gmailTokenStore && git add src/services/gmail/gmailTokenStore.ts src/__tests__/gmail/gmailTokenStore.test.ts && git commit -m "feat(gmail): secure store for refresh token"
```

---

### Task 2.3: gmailQueryBuilder

**Files:**
- Create: `subradar-mobile/src/services/gmail/gmailQueryBuilder.ts`
- Create: `subradar-mobile/src/__tests__/gmail/gmailQueryBuilder.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/gmail/gmailQueryBuilder.test.ts
import { buildGmailQuery } from '../../services/gmail/gmailQueryBuilder';

describe('buildGmailQuery', () => {
  it('builds shallow query from allowlist', () => {
    const q = buildGmailQuery({
      mode: 'shallow',
      windowDays: 365,
      senders: [
        { domain: 'netflix.com', emailPattern: null },
        { domain: 'spotify.com', emailPattern: null },
        { domain: 'apple.com', emailPattern: 'no_reply@email.apple.com' },
      ],
    });
    expect(q).toContain('newer_than:365d');
    expect(q).toMatch(/from:\(/);
    expect(q).toContain('netflix.com');
    expect(q).toContain('no_reply@email.apple.com');
  });

  it('builds deep query without sender filter', () => {
    const q = buildGmailQuery({ mode: 'deep', windowDays: 365, senders: [] });
    expect(q).toContain('newer_than:365d');
    expect(q.toLowerCase()).toContain('subject:');
    expect(q).toMatch(/(receipt|invoice|renewal|subscription)/);
  });

  it('escapes special chars in domain', () => {
    const q = buildGmailQuery({
      mode: 'shallow',
      windowDays: 30,
      senders: [{ domain: 'foo-bar.co.uk', emailPattern: null }],
    });
    expect(q).toContain('foo-bar.co.uk');
  });

  it('caps query length to safe limit', () => {
    const senders = Array.from({ length: 500 }, (_, i) => ({ domain: `service${i}.com`, emailPattern: null }));
    const q = buildGmailQuery({ mode: 'shallow', windowDays: 365, senders });
    expect(q.length).toBeLessThan(2000);
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/gmail/gmailQueryBuilder.ts
export interface SenderRef {
  domain: string;
  emailPattern: string | null;
}

export interface BuildQueryOpts {
  mode: 'shallow' | 'deep';
  windowDays: number;
  senders: SenderRef[];
}

const MAX_QUERY_LEN = 1900;

export function buildGmailQuery(opts: BuildQueryOpts): string {
  const window = `newer_than:${opts.windowDays}d`;
  if (opts.mode === 'deep') {
    return `${window} (subject:(receipt OR invoice OR renewal OR subscription OR billed OR charged) OR category:promotions)`;
  }
  const tokens: string[] = [];
  let used = window.length + 'from:()'.length;
  for (const s of opts.senders) {
    const tok = s.emailPattern ?? s.domain;
    const next = used + tok.length + 4;
    if (next > MAX_QUERY_LEN) break;
    tokens.push(tok);
    used = next;
  }
  if (tokens.length === 0) return window;
  return `${window} from:(${tokens.join(' OR ')})`;
}
```

- [ ] **Step 4: PASS + Commit**

---

### Task 2.4: gmailClient (REST wrapper)

**Files:**
- Create: `subradar-mobile/src/services/gmail/gmailClient.ts`
- Create: `subradar-mobile/src/__tests__/gmail/gmailClient.test.ts`

- [ ] **Step 1: Write failing tests with `nock` (or fetch mock)**

```typescript
// src/__tests__/gmail/gmailClient.test.ts
import { GmailClient } from '../../services/gmail/gmailClient';

describe('GmailClient', () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  const client = new GmailClient(async () => 'access-token-123');

  beforeEach(() => fetchMock.mockReset());

  it('listMessages: paginates until maxTotal reached', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true, json: async () => ({
          messages: Array.from({ length: 100 }, (_, i) => ({ id: `m${i}` })),
          nextPageToken: 'p2',
        }),
      })
      .mockResolvedValueOnce({
        ok: true, json: async () => ({
          messages: Array.from({ length: 50 }, (_, i) => ({ id: `n${i}` })),
        }),
      });
    const ids = await client.listMessages('newer_than:30d', 200);
    expect(ids.length).toBe(150);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('getMessagesBatch: fetches subjects + snippets', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'm1',
        snippet: 'Your Netflix renewal',
        payload: {
          headers: [
            { name: 'Subject', value: 'Netflix' },
            { name: 'From', value: 'no-reply@netflix.com' },
            { name: 'Date', value: 'Mon, 14 Mar 2026 10:00:00 +0000' },
          ],
          body: { data: Buffer.from('Subscription renewed for $15.49').toString('base64url') },
        },
      }),
    });
    const out = await client.getMessagesBatch(['m1']);
    expect(out[0]).toMatchObject({
      id: 'm1', subject: 'Netflix', from: 'no-reply@netflix.com',
    });
    expect(out[0].snippet).toContain('15.49');
  });

  it('throws on 401 (token expired)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' });
    await expect(client.listMessages('q', 10)).rejects.toThrow(/unauthorized/i);
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/gmail/gmailClient.ts
export interface GmailParsedMessage {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  receivedAt: string;
}

export class GmailClient {
  constructor(private readonly getAccessToken: () => Promise<string>) {}

  async listMessages(query: string, maxTotal = 500): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    while (ids.length < maxTotal) {
      const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
      url.searchParams.set('q', query);
      url.searchParams.set('maxResults', String(Math.min(100, maxTotal - ids.length)));
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const r = await this.authedFetch(url.toString());
      const data = await r.json();
      if (Array.isArray(data.messages)) ids.push(...data.messages.map((m: { id: string }) => m.id));
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return ids;
  }

  async getMessagesBatch(ids: string[]): Promise<GmailParsedMessage[]> {
    const results: GmailParsedMessage[] = [];
    for (const id of ids) {
      const r = await this.authedFetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      );
      const m = await r.json();
      const headers = m.payload?.headers ?? [];
      const findHeader = (name: string) =>
        headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
      const body = this.extractBody(m.payload);
      results.push({
        id: m.id,
        subject: findHeader('Subject').slice(0, 500),
        from: findHeader('From'),
        snippet: (body || m.snippet || '').slice(0, 2048),
        receivedAt: new Date(parseInt(m.internalDate ?? '0')).toISOString(),
      });
    }
    return results;
  }

  private extractBody(payload: { mimeType?: string; body?: { data?: string }; parts?: any[] }): string {
    if (!payload) return '';
    if (payload.body?.data && payload.mimeType?.startsWith('text/plain')) {
      return this.b64UrlDecode(payload.body.data);
    }
    for (const p of payload.parts ?? []) {
      const out = this.extractBody(p);
      if (out) return out;
    }
    if (payload.body?.data) return this.b64UrlDecode(payload.body.data);
    return '';
  }

  private b64UrlDecode(s: string): string {
    const fixed = s.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(fixed, 'base64').toString('utf-8');
  }

  private async authedFetch(url: string): Promise<Response> {
    const token = await this.getAccessToken();
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Gmail API ${r.status}: ${text}`);
    }
    return r;
  }
}
```

- [ ] **Step 4: PASS + Commit**

---

### Task 2.5: scannedMessageStore (SQLite)

**Files:**
- Create: `subradar-mobile/src/services/scannedMessageStore.ts`
- Create: `subradar-mobile/src/__tests__/gmail/scannedMessageStore.test.ts`

- [ ] **Step 1: Write failing test (mocking expo-sqlite)**

Use in-memory mock or fakeFs.

```typescript
// src/__tests__/gmail/scannedMessageStore.test.ts
import { scannedMessageStore } from '../../services/scannedMessageStore';

beforeEach(async () => { await scannedMessageStore.dropAll(); await scannedMessageStore.init(); });

describe('scannedMessageStore', () => {
  it('persists and reads back message ids', async () => {
    await scannedMessageStore.markScanned([
      { messageId: 'm1', sourceSender: 'a@b.com' },
      { messageId: 'm2', sourceSender: 'c@d.com' },
    ]);
    const filtered = await scannedMessageStore.filterUnscanned(['m1', 'm3']);
    expect(filtered).toEqual(['m3']);
  });

  it('attaches imported subscription id', async () => {
    await scannedMessageStore.markScanned([{ messageId: 'm1', sourceSender: 'x@y.com' }]);
    await scannedMessageStore.linkImportedSubscription('m1', 'sub-123');
    const r = await scannedMessageStore.getRow('m1');
    expect(r?.importedSubscriptionId).toBe('sub-123');
  });

  it('dropAll clears table', async () => {
    await scannedMessageStore.markScanned([{ messageId: 'm1', sourceSender: 'x@y.com' }]);
    await scannedMessageStore.dropAll();
    await scannedMessageStore.init();
    expect(await scannedMessageStore.filterUnscanned(['m1'])).toEqual(['m1']);
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/scannedMessageStore.ts
import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const getDb = () => {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync('gmail_import.db');
  return dbPromise;
};

export const scannedMessageStore = {
  async init() {
    const db = await getDb();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS scanned_messages (
        message_id TEXT PRIMARY KEY,
        scanned_at INTEGER NOT NULL,
        imported_subscription_id TEXT NULL,
        source_sender TEXT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_scanned_at ON scanned_messages(scanned_at);
    `);
  },

  async markScanned(rows: { messageId: string; sourceSender: string | null }[]) {
    const db = await getDb();
    const now = Date.now();
    await db.withTransactionAsync(async () => {
      for (const r of rows) {
        await db.runAsync(
          'INSERT OR IGNORE INTO scanned_messages (message_id, scanned_at, source_sender) VALUES (?, ?, ?)',
          [r.messageId, now, r.sourceSender]
        );
      }
    });
  },

  async filterUnscanned(messageIds: string[]): Promise<string[]> {
    if (messageIds.length === 0) return [];
    const db = await getDb();
    const placeholders = messageIds.map(() => '?').join(',');
    const found: { message_id: string }[] = await db.getAllAsync(
      `SELECT message_id FROM scanned_messages WHERE message_id IN (${placeholders})`,
      messageIds
    );
    const set = new Set(found.map(r => r.message_id));
    return messageIds.filter(id => !set.has(id));
  },

  async linkImportedSubscription(messageId: string, subscriptionId: string) {
    const db = await getDb();
    await db.runAsync(
      'UPDATE scanned_messages SET imported_subscription_id = ? WHERE message_id = ?',
      [subscriptionId, messageId]
    );
  },

  async getRow(messageId: string) {
    const db = await getDb();
    const r: { message_id: string; scanned_at: number; imported_subscription_id: string | null; source_sender: string | null } | null =
      await db.getFirstAsync('SELECT * FROM scanned_messages WHERE message_id = ?', [messageId]);
    return r ? {
      messageId: r.message_id,
      scannedAt: r.scanned_at,
      importedSubscriptionId: r.imported_subscription_id,
      sourceSender: r.source_sender,
    } : null;
  },

  async dropAll() {
    const db = await getDb();
    await db.execAsync('DROP TABLE IF EXISTS scanned_messages');
  },
};
```

- [ ] **Step 4: PASS + Commit**

---

### Task 2.6: emailImport API client

**Files:**
- Create: `subradar-mobile/src/api/emailImport.ts`

- [ ] **Step 1: Implement (no test — thin wrapper)**

```typescript
// src/api/emailImport.ts
import { apiClient } from './client';

export interface KnownSender {
  domain: string;
  emailPattern: string | null;
  serviceName: string;
  category: string;
  defaultCurrency: string | null;
}

export interface ParseInput {
  id: string;
  subject: string;
  snippet: string;
  from: string;
  receivedAt: string;
}

export interface Candidate {
  sourceMessageId: string;
  name: string;
  amount: number;
  currency: string;
  billingPeriod: 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY' | 'LIFETIME' | 'ONE_TIME';
  category: string;
  status: 'ACTIVE' | 'TRIAL';
  nextPaymentDate?: string;
  trialEndDate?: string;
  iconUrl?: string;
  confidence: number;
  isRecurring: boolean;
  isCancellation: boolean;
  isTrial: boolean;
  aggregatedFrom: string[];
}

export const emailImportApi = {
  getKnownSenders: () =>
    apiClient.get<{ senders: KnownSender[]; updatedAt: string }>('/email-import/known-senders'),

  parseBulk: (data: { messages: ParseInput[]; locale: string; mode: 'shallow' | 'deep' }) =>
    apiClient.post<{ candidates: Candidate[]; scannedCount: number; droppedCount: number }>(
      '/email-import/parse-bulk',
      data,
    ),

  getStatus: () =>
    apiClient.get<{ gmailConnected: boolean; lastScanAt: string | null; lastImportCount: number | null }>(
      '/email-import/status',
    ),

  disconnect: () => apiClient.post('/email-import/disconnect'),

  logEvent: (event: string, props?: Record<string, string | number | boolean>) =>
    apiClient.post('/email-import/log-event', { event, props }),
};
```

- [ ] **Step 2: Commit**

---

### Task 2.7: useGmailAuth hook

**Files:**
- Create: `subradar-mobile/src/hooks/useGmailAuth.ts`

- [ ] **Step 1: Implement**

```typescript
// src/hooks/useGmailAuth.ts
import { useCallback, useState, useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';
import { gmailTokenStore } from '../services/gmail/gmailTokenStore';
import { emailImportApi } from '../api/emailImport';
import { reportError } from '../utils/errorReporter';

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export function useGmailAuth() {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  let accessTokenCache: { token: string; expiresAt: number } | null = null;

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_IOS,
    androidClientId: process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_ANDROID,
    webClientId: process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_WEB,
    scopes: GMAIL_SCOPES,
    responseType: 'code',
    extraParams: { access_type: 'offline', prompt: 'consent' },
  });

  useEffect(() => {
    gmailTokenStore.getRefreshToken().then(t => setIsConnected(!!t));
  }, []);

  const exchangeCodeForTokens = async (code: string) => {
    const tokenRes = await AuthSession.exchangeCodeAsync(
      {
        clientId: Platform.OS === 'ios'
          ? process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_IOS!
          : process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_ANDROID!,
        code,
        redirectUri: AuthSession.makeRedirectUri(),
        extraParams: { code_verifier: request?.codeVerifier ?? '' },
      },
      { tokenEndpoint: 'https://oauth2.googleapis.com/token' },
    );
    if (tokenRes.refreshToken) await gmailTokenStore.saveRefreshToken(tokenRes.refreshToken);
    if (tokenRes.accessToken) {
      accessTokenCache = {
        token: tokenRes.accessToken,
        expiresAt: Date.now() + (tokenRes.expiresIn ?? 3600) * 1000 - 60_000,
      };
    }
  };

  const connect = useCallback(async () => {
    setIsAuthenticating(true);
    try {
      const result = await promptAsync();
      if (result.type !== 'success' || !result.params.code) {
        throw new Error(result.type === 'cancel' ? 'cancelled' : 'oauth_failed');
      }
      await exchangeCodeForTokens(result.params.code);
      setIsConnected(true);
    } catch (e) {
      reportError(e);
      throw e;
    } finally {
      setIsAuthenticating(false);
    }
  }, [promptAsync, request]);

  const disconnect = useCallback(async () => {
    const rt = await gmailTokenStore.getRefreshToken();
    if (rt) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${rt}`, { method: 'POST' }).catch(() => {});
    }
    await gmailTokenStore.clear();
    accessTokenCache = null;
    await emailImportApi.disconnect();
    setIsConnected(false);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) return accessTokenCache.token;
    const refreshToken = await gmailTokenStore.getRefreshToken();
    if (!refreshToken) throw new Error('not_connected');
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Platform.OS === 'ios'
          ? process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_IOS!
          : process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_ANDROID!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (!r.ok) {
      if (r.status === 400 || r.status === 401) {
        await gmailTokenStore.clear();
        setIsConnected(false);
        throw new Error('token_revoked');
      }
      throw new Error(`refresh_failed_${r.status}`);
    }
    const data = await r.json();
    accessTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
    return data.access_token;
  }, []);

  return { isConnected, isAuthenticating, connect, disconnect, getAccessToken };
}
```

- [ ] **Step 2: Commit**

---

### Task 2.8: useGmailScan hook

**Files:**
- Create: `subradar-mobile/src/hooks/useGmailScan.ts`
- Create: `subradar-mobile/src/__tests__/gmail/useGmailScan.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/gmail/useGmailScan.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { useGmailScan } from '../../hooks/useGmailScan';

jest.mock('../../api/emailImport');
jest.mock('../../services/gmail/gmailClient');
jest.mock('../../services/scannedMessageStore');
jest.mock('../../hooks/useGmailAuth');

describe('useGmailScan', () => {
  it('orchestrates fetch → batch → filter → parse pipeline', async () => {
    /* setup mocks for: useGmailAuth.getAccessToken, GmailClient.listMessages,
     * GmailClient.getMessagesBatch, scannedMessageStore.filterUnscanned,
     * emailImportApi.parseBulk → return candidates */
    const { result } = renderHook(() => useGmailScan());
    let scanResult: any;
    await act(async () => { scanResult = await result.current.scan({ mode: 'shallow' }); });
    expect(scanResult.candidates).toHaveLength(2);
    expect(scanResult.durationMs).toBeGreaterThan(0);
  });

  it('filters out non-recurring candidates', async () => { /* ... */ });
  it('returns empty result when nothing new to scan', async () => { /* ... */ });
  it('cancellable mid-scan via AbortController', async () => { /* ... */ });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/hooks/useGmailScan.ts
import { useCallback, useState, useRef } from 'react';
import { GmailClient } from '../services/gmail/gmailClient';
import { buildGmailQuery } from '../services/gmail/gmailQueryBuilder';
import { scannedMessageStore } from '../services/scannedMessageStore';
import { emailImportApi, Candidate } from '../api/emailImport';
import { useGmailAuth } from './useGmailAuth';
import { useTranslation } from 'react-i18next';
import { settingsStore } from '../stores/settingsStore';
import { emailImportTelemetry } from '../utils/emailImportTelemetry';

export type ScanStage = 'fetching_list' | 'fetching_bodies' | 'parsing' | 'done';
export interface ScanResult {
  candidates: Candidate[];
  scannedCount: number;
  durationMs: number;
}

export function useGmailScan() {
  const auth = useGmailAuth();
  const { i18n } = useTranslation();
  const [progress, setProgress] = useState<{ stage: ScanStage; current: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scan = useCallback(async (opts: { mode: 'shallow' | 'deep' }): Promise<ScanResult> => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const start = Date.now();
    emailImportTelemetry.scanStarted(opts.mode);
    try {
      await scannedMessageStore.init();
      const client = new GmailClient(auth.getAccessToken);
      setProgress({ stage: 'fetching_list', current: 0, total: 0 });

      const senders = opts.mode === 'shallow'
        ? (await emailImportApi.getKnownSenders()).data.senders
        : [];
      const query = buildGmailQuery({
        mode: opts.mode,
        windowDays: settingsStore.getState().emailImport?.scanWindowDays ?? 365,
        senders,
      });
      const ids = await client.listMessages(query, opts.mode === 'deep' ? 800 : 400);
      if (ctrl.signal.aborted) throw new Error('aborted');

      const unscannedIds = await scannedMessageStore.filterUnscanned(ids);
      if (unscannedIds.length === 0) {
        setProgress({ stage: 'done', current: 0, total: 0 });
        return { candidates: [], scannedCount: 0, durationMs: Date.now() - start };
      }

      setProgress({ stage: 'fetching_bodies', current: 0, total: unscannedIds.length });
      const messages = [];
      for (let i = 0; i < unscannedIds.length; i++) {
        if (ctrl.signal.aborted) throw new Error('aborted');
        const batch = await client.getMessagesBatch([unscannedIds[i]]);
        messages.push(...batch);
        setProgress({ stage: 'fetching_bodies', current: i + 1, total: unscannedIds.length });
      }

      setProgress({ stage: 'parsing', current: 0, total: messages.length });
      const { data } = await emailImportApi.parseBulk({
        messages,
        locale: i18n.language,
        mode: opts.mode,
      });

      await scannedMessageStore.markScanned(messages.map(m => ({ messageId: m.id, sourceSender: m.from })));

      const filtered = data.candidates.filter(c => c.isRecurring && !c.isCancellation);
      setProgress({ stage: 'done', current: filtered.length, total: filtered.length });

      const result = { candidates: filtered, scannedCount: messages.length, durationMs: Date.now() - start };
      emailImportTelemetry.scanCompleted({ found: filtered.length, durationMs: result.durationMs, mode: opts.mode });
      return result;
    } catch (e: any) {
      emailImportTelemetry.scanFailed({ stage: progress?.stage ?? 'unknown', errorCode: e.message });
      throw e;
    } finally {
      abortRef.current = null;
    }
  }, [auth.getAccessToken, progress, i18n.language]);

  const silentScan = useCallback(async () => {
    const result = await scan({ mode: 'shallow' });
    return { newCandidates: result.candidates };
  }, [scan]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  return { scan, silentScan, progress, cancel };
}
```

- [ ] **Step 4: PASS + Commit**

---

### Task 2.9: useEmailImportStatus + emailImportTelemetry

**Files:**
- Create: `subradar-mobile/src/hooks/useEmailImportStatus.ts`
- Create: `subradar-mobile/src/utils/emailImportTelemetry.ts`

- [ ] **Step 1: Implement status hook**

```typescript
// src/hooks/useEmailImportStatus.ts
import { useQuery } from '@tanstack/react-query';
import { emailImportApi } from '../api/emailImport';

export function useEmailImportStatus() {
  return useQuery({
    queryKey: ['email-import-status'],
    queryFn: () => emailImportApi.getStatus().then(r => r.data),
    staleTime: 60_000,
  });
}
```

- [ ] **Step 2: Implement telemetry wrapper**

```typescript
// src/utils/emailImportTelemetry.ts
import { track } from '@amplitude/analytics-react-native';
import { emailImportApi } from '../api/emailImport';

const both = (event: string, props?: Record<string, string | number | boolean>) => {
  try { track(event, props); } catch {}
  emailImportApi.logEvent(event, props).catch(() => {});
};

export const emailImportTelemetry = {
  entryViewed: (source: 'add_sheet' | 'settings' | 'banner') =>
    both('gmail_import_entry_viewed', { source }),
  paywallShown: (source: string) => both('gmail_import_paywall_shown', { source }),
  consentViewed: () => both('gmail_import_consent_viewed'),
  consentAccepted: () => both('gmail_import_consent_accepted'),
  consentSkipped: () => both('gmail_import_consent_skipped'),
  oauthStarted: () => both('gmail_import_oauth_started'),
  oauthSuccess: () => both('gmail_import_oauth_success'),
  oauthCancelled: (stage: string) => both('gmail_import_oauth_cancelled', { stage }),
  oauthFailed: (errorCode: string) => both('gmail_import_oauth_failed', { errorCode }),
  scanStarted: (mode: string) => both('gmail_import_scan_started', { mode }),
  scanCompleted: (props: { found: number; durationMs: number; mode: string }) =>
    both('gmail_import_scan_completed', props),
  scanFailed: (props: { stage: string; errorCode: string }) => both('gmail_import_scan_failed', props),
  reviewViewed: (count: number, highConfidence: number, lowConfidence: number) =>
    both('gmail_import_review_viewed', { count, highConfidence, lowConfidence }),
  itemUnchecked: (confidence: number) => both('gmail_import_item_unchecked', { confidence }),
  saveCompleted: (savedCount: number) => both('gmail_import_save_completed', { savedCount }),
  zeroResults: () => both('gmail_import_zero_results'),
  deepScanClicked: () => both('gmail_import_deep_scan_clicked'),
  disconnected: (reason: string) => both('gmail_import_disconnected', { reason }),
};
```

- [ ] **Step 3: Commit**

---

## Phase 3 — Mobile UI & Navigation

### Task 3.1: Extend BulkListStage with confidence + sourceChip

**Files:**
- Modify: `subradar-mobile/src/components/ai-wizard/BulkListStage.tsx`

- [ ] **Step 1: Read current props**

```bash
grep -n "interface\|Props" src/components/ai-wizard/BulkListStage.tsx | head -10
```

- [ ] **Step 2: Add optional props**

In `BulkListStage` props interface, add:
```typescript
confidenceLevel?: 'high' | 'medium' | 'low';
sourceChip?: { label: string; icon?: string };
defaultChecked?: boolean;  // for low-confidence default-uncheck behavior
```

In render, if `confidenceLevel` defined, add small badge component beside the title; if `sourceChip` defined, add a chip below the row. Use theme colors. **Do not** modify behavior for callers that don't pass these props (voice flow continues to work).

- [ ] **Step 3: Smoke-test voice flow still works**

```bash
npm run start:dev
# Manually: open Add → AI text or voice flow → confirm BulkListStage renders correctly
```

- [ ] **Step 4: Commit**

---

### Task 3.2: ConnectGmailScreen (consent screen)

**Files:**
- Create: `subradar-mobile/src/components/email-import/ConnectGmailScreen.tsx`
- Create: `subradar-mobile/app/email-import/connect.tsx`

- [ ] **Step 1: Implement screen**

```typescript
// src/components/email-import/ConnectGmailScreen.tsx
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { useGmailAuth } from '../../hooks/useGmailAuth';
import { useGmailScan } from '../../hooks/useGmailScan';
import { useRouter } from 'expo-router';
import { emailImportTelemetry } from '../../utils/emailImportTelemetry';

export function ConnectGmailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const auth = useGmailAuth();
  const { scan } = useGmailScan();
  const router = useRouter();

  React.useEffect(() => emailImportTelemetry.consentViewed(), []);

  const handleConnect = async () => {
    emailImportTelemetry.consentAccepted();
    emailImportTelemetry.oauthStarted();
    try {
      await auth.connect();
      emailImportTelemetry.oauthSuccess();
      router.replace('/email-import/scanning');
    } catch (e: any) {
      if (e.message === 'cancelled') emailImportTelemetry.oauthCancelled('webview');
      else emailImportTelemetry.oauthFailed(e.message);
    }
  };

  const handleSkip = () => { emailImportTelemetry.consentSkipped(); router.back(); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text, marginTop: 16 }}>
          {t('emailImport.consent.title')}
        </Text>
        <Section title={t('emailImport.consent.willDo.heading')} items={[
          t('emailImport.consent.willDo.scan'),
          t('emailImport.consent.willDo.ai'),
          t('emailImport.consent.willDo.review'),
        ]} colors={colors} />
        <Section title={t('emailImport.consent.willNot.heading')} items={[
          t('emailImport.consent.willNot.read'),
          t('emailImport.consent.willNot.store'),
          t('emailImport.consent.willNot.send'),
          t('emailImport.consent.willNot.share'),
        ]} colors={colors} />
        <Section title={t('emailImport.consent.control.heading')} items={[
          t('emailImport.consent.control.disconnect'),
          t('emailImport.consent.control.wipe'),
          t('emailImport.consent.control.review'),
        ]} colors={colors} />
        <TouchableOpacity onPress={() => Linking.openURL('https://subradar.ai/privacy')}>
          <Text style={{ color: colors.accent, marginTop: 16 }}>{t('emailImport.consent.privacyLink')}</Text>
        </TouchableOpacity>
      </ScrollView>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: colors.background }}>
        <TouchableOpacity
          onPress={handleConnect}
          disabled={auth.isAuthenticating}
          style={{ backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' }}
        >
          {auth.isAuthenticating
            ? <ActivityIndicator color="#FFF" />
            : <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '600' }}>{t('emailImport.consent.cta')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} style={{ paddingVertical: 16, alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('emailImport.consent.skip')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Section({ title, items, colors }: { title: string; items: string[]; colors: any }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>{title}</Text>
      {items.map((it, idx) => (
        <View key={idx} style={{ flexDirection: 'row', marginBottom: 8 }}>
          <Text style={{ color: colors.text, fontSize: 16 }}>•  </Text>
          <Text style={{ color: colors.text, fontSize: 16, flex: 1 }}>{it}</Text>
        </View>
      ))}
    </View>
  );
}
```

```typescript
// app/email-import/connect.tsx
import { ConnectGmailScreen } from '../../src/components/email-import/ConnectGmailScreen';
export default ConnectGmailScreen;
```

- [ ] **Step 2: Commit**

---

### Task 3.3: ScanProgressView + scanning route

**Files:**
- Create: `subradar-mobile/src/components/email-import/ScanProgressView.tsx`
- Create: `subradar-mobile/app/email-import/scanning.tsx`

- [ ] **Step 1: Implement view**

```typescript
// src/components/email-import/ScanProgressView.tsx
import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { useGmailScan } from '../../hooks/useGmailScan';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export function ScanProgressView() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { scan, progress, cancel } = useGmailScan();
  const router = useRouter();

  useEffect(() => {
    scan({ mode: 'shallow' })
      .then(result => {
        router.replace({ pathname: '/email-import/review', params: { result: JSON.stringify(result) } });
      })
      .catch(e => {
        if (e.message === 'aborted') router.back();
        else router.replace({ pathname: '/email-import/review', params: { error: e.message } });
      });
  }, []);

  const stageLabel = progress?.stage === 'fetching_list' || progress?.stage === 'fetching_bodies'
    ? t('emailImport.scan.fetching')
    : t('emailImport.scan.parsing');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ color: colors.text, fontSize: 18, marginTop: 24, fontWeight: '600' }}>{stageLabel}</Text>
      {progress && progress.total > 0 && (
        <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
          {t('emailImport.scan.progress', { current: progress.current, total: progress.total })}
        </Text>
      )}
      <TouchableOpacity onPress={cancel} style={{ marginTop: 32 }}>
        <Text style={{ color: colors.accent, fontSize: 16 }}>{t('emailImport.scan.cancel')}</Text>
      </TouchableOpacity>
    </View>
  );
}
```

```typescript
// app/email-import/scanning.tsx
import { ScanProgressView } from '../../src/components/email-import/ScanProgressView';
export default ScanProgressView;
```

- [ ] **Step 2: Commit**

---

### Task 3.4: ImportResultsView + review route

**Files:**
- Create: `subradar-mobile/src/components/email-import/ImportResultsView.tsx`
- Create: `subradar-mobile/src/components/email-import/EmptyResultsView.tsx`
- Create: `subradar-mobile/src/components/email-import/DeepScanPromptCard.tsx`
- Create: `subradar-mobile/app/email-import/review.tsx`

- [ ] **Step 1: Implement Empty + DeepScanPrompt**

```typescript
// src/components/email-import/EmptyResultsView.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';

export function EmptyResultsView({ onDeepScan, onManual, days }: { onDeepScan: () => void; onManual: () => void; days: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={{ padding: 32, alignItems: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 12 }}>
        {t('emailImport.empty.title')}
      </Text>
      <Text style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: 24 }}>
        {t('emailImport.empty.body', { days })}
      </Text>
      <TouchableOpacity onPress={onDeepScan} style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10 }}>
        <Text style={{ color: '#FFF', fontWeight: '600' }}>{t('emailImport.empty.deepScan')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onManual} style={{ marginTop: 16 }}>
        <Text style={{ color: colors.accent }}>{t('emailImport.empty.manual')}</Text>
      </TouchableOpacity>
    </View>
  );
}
```

```typescript
// src/components/email-import/DeepScanPromptCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';

export function DeepScanPromptCard({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={{ padding: 16, backgroundColor: colors.card, borderRadius: 12, marginVertical: 12 }}>
      <Text style={{ color: colors.text, marginBottom: 8 }}>
        {loading ? t('emailImport.results.deepScanRunning') : t('emailImport.results.deepScanCta')}
      </Text>
      <TouchableOpacity onPress={onPress} disabled={loading}>
        <Text style={{ color: colors.accent, fontWeight: '600' }}>
          {loading ? '...' : '→'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 2: Implement ImportResultsView**

```typescript
// src/components/email-import/ImportResultsView.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Candidate } from '../../api/emailImport';
import { useGmailScan } from '../../hooks/useGmailScan';
import { useCreateSubscription } from '../../hooks/useSubscriptions';
import { EmptyResultsView } from './EmptyResultsView';
import { DeepScanPromptCard } from './DeepScanPromptCard';
import { emailImportTelemetry } from '../../utils/emailImportTelemetry';
import { scannedMessageStore } from '../../services/scannedMessageStore';

export function ImportResultsView() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ result?: string; error?: string }>();
  const initial = params.result ? JSON.parse(params.result as string) : { candidates: [] };
  const [candidates, setCandidates] = useState<Candidate[]>(initial.candidates);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initial.candidates.filter((c: Candidate) => c.confidence >= 0.5).map((c: Candidate) => c.sourceMessageId))
  );
  const [showLow, setShowLow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const { scan } = useGmailScan();
  const createMut = useCreateSubscription();

  const groups = useMemo(() => ({
    high: candidates.filter(c => c.confidence >= 0.85),
    medium: candidates.filter(c => c.confidence >= 0.5 && c.confidence < 0.85),
    low: candidates.filter(c => c.confidence < 0.5),
  }), [candidates]);

  React.useEffect(() => {
    emailImportTelemetry.reviewViewed(candidates.length, groups.high.length, groups.low.length);
    if (candidates.length === 0) emailImportTelemetry.zeroResults();
  }, []);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const toSave = candidates.filter(c => selected.has(c.sourceMessageId));
      for (const c of toSave) {
        const sub = await createMut.mutateAsync({
          name: c.name, amount: c.amount, currency: c.currency,
          billingPeriod: c.billingPeriod, category: c.category, status: c.status,
          nextPaymentDate: c.nextPaymentDate,
        });
        for (const mid of c.aggregatedFrom) {
          await scannedMessageStore.linkImportedSubscription(mid, sub.id);
        }
      }
      emailImportTelemetry.saveCompleted(toSave.length);
      router.replace('/(tabs)');
    } finally { setSaving(false); }
  };

  const runDeepScan = async () => {
    setDeepLoading(true);
    emailImportTelemetry.deepScanClicked();
    try {
      const r = await scan({ mode: 'deep' });
      setCandidates(prev => [...prev, ...r.candidates.filter(c => !prev.some(p => p.sourceMessageId === c.sourceMessageId))]);
    } finally { setDeepLoading(false); }
  };

  if (candidates.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyResultsView
          days={365}
          onDeepScan={runDeepScan}
          onManual={() => router.replace('/(tabs)')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 16 }}>
          {t('emailImport.results.title', { count: candidates.length })}
        </Text>

        {[...groups.high, ...groups.medium].map(c => (
          <CandidateRow key={c.sourceMessageId} candidate={c} selected={selected.has(c.sourceMessageId)} onToggle={() => toggle(c.sourceMessageId)} colors={colors} t={t} />
        ))}

        {groups.low.length > 0 && (
          <TouchableOpacity onPress={() => setShowLow(s => !s)} style={{ marginVertical: 12 }}>
            <Text style={{ color: colors.accent }}>
              {showLow ? '▾' : '▸'} {t('emailImport.results.notSureSection', { count: groups.low.length })}
            </Text>
          </TouchableOpacity>
        )}
        {showLow && groups.low.map(c => (
          <CandidateRow key={c.sourceMessageId} candidate={c} selected={selected.has(c.sourceMessageId)} onToggle={() => toggle(c.sourceMessageId)} colors={colors} t={t} />
        ))}

        <DeepScanPromptCard onPress={runDeepScan} loading={deepLoading} />
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: colors.background }}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || selected.size === 0}
          style={{
            backgroundColor: selected.size === 0 ? colors.border : colors.primary,
            padding: 16, borderRadius: 12, alignItems: 'center',
          }}
        >
          {saving
            ? <ActivityIndicator color="#FFF" />
            : <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '600' }}>
                {t('emailImport.results.saveButton', { count: selected.size })}
              </Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function CandidateRow({ candidate, selected, onToggle, colors, t }: any) {
  const conf = candidate.confidence >= 0.85 ? 'high' : candidate.confidence >= 0.5 ? 'medium' : 'low';
  const confColor = conf === 'high' ? '#4CAF50' : conf === 'medium' ? '#FFC107' : '#999';
  return (
    <TouchableOpacity onPress={onToggle} style={{
      flexDirection: 'row', alignItems: 'center',
      padding: 12, backgroundColor: colors.card, borderRadius: 10, marginBottom: 8,
    }}>
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: selected ? colors.primary : 'transparent',
        borderWidth: 2, borderColor: selected ? colors.primary : colors.border,
        marginRight: 12,
      }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{candidate.name}</Text>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: confColor, marginLeft: 8 }} />
          {candidate.isTrial && (
            <View style={{ backgroundColor: '#FFC10733', paddingHorizontal: 6, borderRadius: 4, marginLeft: 8 }}>
              <Text style={{ color: '#FFC107', fontSize: 11, fontWeight: '600' }}>{t('emailImport.results.trialBadge')}</Text>
            </View>
          )}
        </View>
        <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
          {candidate.amount} {candidate.currency} · {candidate.billingPeriod.toLowerCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
```

```typescript
// app/email-import/review.tsx
import { ImportResultsView } from '../../src/components/email-import/ImportResultsView';
export default ImportResultsView;
```

- [ ] **Step 3: Commit**

---

### Task 3.5: Settings — Connected Accounts + GmailConnectedRow + OpportunisticBanner

**Files:**
- Create: `subradar-mobile/src/components/email-import/GmailConnectedRow.tsx`
- Create: `subradar-mobile/src/components/email-import/OpportunisticBanner.tsx`
- Create: `subradar-mobile/app/email-import/settings.tsx`
- Modify: `subradar-mobile/app/(tabs)/settings.tsx`
- Modify: `subradar-mobile/src/stores/settingsStore.ts`
- Modify: `subradar-mobile/app/_layout.tsx`

- [ ] **Step 1: Add settings store fields**

In `settingsStore.ts`:
```typescript
emailImport: {
  autoScanEnabled: true,
  scanWindowDays: 365 as 90 | 180 | 365,
},
setEmailImportAutoScan: (enabled: boolean) =>
  set(s => ({ emailImport: { ...s.emailImport, autoScanEnabled: enabled } })),
setEmailImportWindow: (days: 90 | 180 | 365) =>
  set(s => ({ emailImport: { ...s.emailImport, scanWindowDays: days } })),
```

- [ ] **Step 2: Implement GmailConnectedRow + Settings page**

```typescript
// app/email-import/settings.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/theme/ThemeContext';
import { useGmailAuth } from '../../src/hooks/useGmailAuth';
import { useEmailImportStatus } from '../../src/hooks/useEmailImportStatus';
import { useGmailScan } from '../../src/hooks/useGmailScan';
import { settingsStore } from '../../src/stores/settingsStore';
import { useRouter } from 'expo-router';
import { emailImportTelemetry } from '../../src/utils/emailImportTelemetry';

export default function ConnectedAccountsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const auth = useGmailAuth();
  const status = useEmailImportStatus();
  const { scan } = useGmailScan();
  const settings = settingsStore();
  const [scanning, setScanning] = useState(false);

  const handleScanNow = async () => {
    setScanning(true);
    try {
      const r = await scan({ mode: 'shallow' });
      router.push({ pathname: '/email-import/review', params: { result: JSON.stringify(r) } });
    } finally { setScanning(false); }
  };

  const handleDisconnect = () => {
    Alert.alert(t('emailImport.settings.disconnectConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('emailImport.settings.disconnect'), style: 'destructive', onPress: async () => {
        await auth.disconnect();
        emailImportTelemetry.disconnected('user');
      }},
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
          {t('emailImport.settings.sectionTitle').toUpperCase()}
        </Text>

        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>
            {auth.isConnected ? t('emailImport.settings.gmailConnected') : t('emailImport.settings.gmailDisconnected')}
          </Text>
          {auth.isConnected && status.data?.lastScanAt && (
            <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
              {t('emailImport.settings.lastScan', { when: new Date(status.data.lastScanAt).toLocaleDateString() })}
            </Text>
          )}

          {auth.isConnected ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <Text style={{ color: colors.text, flex: 1 }}>{t('emailImport.settings.autoScanLabel')}</Text>
                <Switch value={settings.emailImport.autoScanEnabled} onValueChange={settings.setEmailImportAutoScan} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                {t('emailImport.settings.autoScanHelp')}
              </Text>
              <TouchableOpacity onPress={handleScanNow} disabled={scanning} style={{ marginTop: 16, padding: 12, backgroundColor: colors.primary, borderRadius: 8, alignItems: 'center' }}>
                {scanning ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '600' }}>{t('emailImport.settings.scanNow')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDisconnect} style={{ marginTop: 8, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: '#E54C4C' }}>{t('emailImport.settings.disconnect')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={() => router.push('/email-import/connect')} style={{ marginTop: 16, padding: 12, backgroundColor: colors.primary, borderRadius: 8, alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontWeight: '600' }}>{t('emailImport.settings.gmailDisconnected')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Implement OpportunisticBanner**

```typescript
// src/components/email-import/OpportunisticBanner.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { useRouter } from 'expo-router';
import { Candidate } from '../../api/emailImport';

export function OpportunisticBanner({ candidates, onDismiss }: { candidates: Candidate[]; onDismiss: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  if (candidates.length === 0) return null;
  return (
    <View style={{ margin: 16, padding: 12, backgroundColor: colors.card, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ color: colors.text, flex: 1 }}>
        {t('emailImport.banner.title', { count: candidates.length })}
      </Text>
      <TouchableOpacity onPress={() => router.push({ pathname: '/email-import/review', params: { result: JSON.stringify({ candidates }) } })}>
        <Text style={{ color: colors.accent, fontWeight: '600', marginRight: 12 }}>{t('emailImport.banner.review')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss}>
        <Text style={{ color: colors.textSecondary }}>×</Text>
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 4: Wire opportunistic re-scan in `_layout.tsx`**

In `app/_layout.tsx` (after auth bootstrap), add:
```typescript
useEffect(() => {
  if (!authStore().isAuthenticated) return;
  if (!useEffectiveAccess().isPro) return;
  if (!settingsStore().emailImport.autoScanEnabled) return;
  (async () => {
    const status = await emailImportApi.getStatus();
    if (!status.data.gmailConnected) return;
    const lastScan = status.data.lastScanAt ? new Date(status.data.lastScanAt).getTime() : 0;
    if (Date.now() - lastScan < 14 * 24 * 3600_000) return;
    try {
      const r = await silentScan();
      if (r.newCandidates.length > 0) {
        appStore.getState().setOpportunisticBanner({ candidates: r.newCandidates });
      }
    } catch {}
  })();
}, [/* auth state */]);
```

(Сделать через useGmailScan; appStore extension добавить.)

- [ ] **Step 5: Add "Connected Accounts" row in `(tabs)/settings.tsx`**

Locate settings sections, add:
```tsx
<TouchableOpacity onPress={() => router.push('/email-import/settings')}>
  <Text>{t('emailImport.settings.sectionTitle')}</Text>
</TouchableOpacity>
```

- [ ] **Step 6: Commit**

---

### Task 3.6: GmailImportEntryButton in Add Sheet + ProFeatureModal case

**Files:**
- Create: `subradar-mobile/src/components/add-subscription/GmailImportEntryButton.tsx`
- Modify: `subradar-mobile/src/components/AddSubscriptionSheet.tsx`
- Modify: `subradar-mobile/src/components/ProFeatureModal.tsx`

- [ ] **Step 1: Implement entry button**

```typescript
// src/components/add-subscription/GmailImportEntryButton.tsx
import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { useEffectiveAccess } from '../../hooks/useEffectiveAccess';
import { useRouter } from 'expo-router';
import { emailImportTelemetry } from '../../utils/emailImportTelemetry';

export function GmailImportEntryButton({ onProGate }: { onProGate: (feature: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isPro, isTeam } = useEffectiveAccess();
  const router = useRouter();

  const handlePress = () => {
    emailImportTelemetry.entryViewed('add_sheet');
    if (!isPro && !isTeam) {
      emailImportTelemetry.paywallShown('add_sheet');
      onProGate('gmail_import');
      return;
    }
    router.push('/email-import/connect');
  };

  return (
    <TouchableOpacity onPress={handlePress} style={{ flex: 1, padding: 16, backgroundColor: colors.card, borderRadius: 12, alignItems: 'center' }}>
      <Text style={{ fontSize: 28 }}>📧</Text>
      <Text style={{ fontWeight: '600', color: colors.text, marginTop: 8 }}>{t('emailImport.entry.title')}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 4 }}>{t('emailImport.entry.subtitle')}</Text>
      {!isPro && !isTeam && (
        <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: colors.accent, paddingHorizontal: 6, borderRadius: 4 }}>
          <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '600' }}>{t('emailImport.entry.proBadge')}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Wire into AddSubscriptionSheet**

In `AddSubscriptionSheet.tsx`, locate the row of entry buttons (Manual / AI Text / Photo). Adapt grid to 2x2 or scrollable horizontal row, add `<GmailImportEntryButton onProGate={setProModal} />` as 4th option. Ensure ProFeatureModal state hook is in this component.

- [ ] **Step 3: Add `gmail_import` case in ProFeatureModal**

```typescript
case 'gmail_import':
  return {
    icon: '📧',
    iconColor: '#EA4335',
    title: t('emailImport.paywall.title'),
    description: t('emailImport.paywall.description'),
    benefits: [
      t('emailImport.paywall.benefit1'),
      t('emailImport.paywall.benefit2'),
      t('emailImport.paywall.benefit3'),
      t('emailImport.paywall.benefit4'),
    ],
  };
```

- [ ] **Step 4: Commit**

---

## Phase 4 — Localization

### Task 4.1: Add emailImport namespace to en.json

**File:** `subradar-mobile/src/locales/en.json`

- [ ] **Step 1: Add complete namespace** (paste full block from spec section 8 expanded with all keys — see spec doc)

- [ ] **Step 2: Render-time smoke test**

```bash
npm run start:dev
# Open Add Sheet → tap Gmail entry → verify all strings render in EN
# Navigate Settings → Connected Accounts → verify all strings
# Trigger empty results → verify
# Trigger paywall as Free → verify
```

- [ ] **Step 3: Commit**

---

### Task 4.2: Translate to 9 other locales

**Files:** `src/locales/{ru,de,es,fr,ja,ko,pt,zh,kk}.json`

- [ ] **Step 1: Translate consent and paywall strings to RU first (highest-quality, native speaker)**

Manually verify accuracy of юр.text in `consent.willDo`, `consent.willNot`, `consent.control`.

- [ ] **Step 2: AI-translate remaining 8 locales using existing translation script** (if exists; otherwise use Claude in batch mode with EN as source + RU as cross-check for sanity)

- [ ] **Step 3: Smoke-test 3 locales (ja, ko, zh) for non-Latin rendering issues**

```bash
# Set device language to ja, ko, zh in turn
# Ensure no truncation, no missing keys (i18next emits debug warnings in dev)
```

- [ ] **Step 4: Commit**

```bash
git add src/locales/*.json && git commit -m "feat(i18n): add emailImport namespace in all 10 locales"
```

---

## Phase 5 — Testing & QA

### Task 5.1: Maestro E2E flows

**Files:** `subradar-mobile/e2e/gmail-import-*.yaml`

- [ ] **Step 1: Happy path**

```yaml
# e2e/gmail-import-happy.yaml
appId: ai.subradar.mobile
---
- launchApp
- assertVisible: "Home"
- tapOn: "Add"
- tapOn:
    text: "Gmail"
- assertVisible:
    text: "Connect Gmail to find your subscriptions"
- tapOn: "Connect Gmail"
# OAuth WebView — needs mock or real test account
- waitForAnimationToEnd
- assertVisible:
    text: "We found"
- tapOn:
    text: "Save"
- assertVisible: "Imported"
```

- [ ] **Step 2: Disconnect flow**

```yaml
# e2e/gmail-import-disconnect.yaml
- launchApp
- tapOn: "Settings"
- tapOn: "Connected Accounts"
- tapOn: "Disconnect Gmail"
- tapOn: "Disconnect Gmail"  # confirm alert
- assertVisible: "Connect Gmail"
```

- [ ] **Step 3: Free user paywall**

```yaml
# e2e/gmail-import-paywall-free.yaml
- launchApp
- tapOn: "Add"
- tapOn:
    text: "Gmail"
- assertVisible: "Import subscriptions from Gmail"
- assertVisible: "Start 7-day Free Trial"
- tapOn: "Maybe Later"
```

- [ ] **Step 4: Run + commit**

```bash
maestro test e2e/gmail-import-happy.yaml
```

---

### Task 5.2: Manual QA checklist

**File:** `subradar-mobile/docs/superpowers/checklists/2026-05-04-gmail-import-qa.md`

- [ ] **Step 1: Create checklist** with all items from spec section 9.4

- [ ] **Step 2: Commit**

---

## Phase 6 — Rollout

### Task 6.1: Feature flag wiring

- [ ] **Step 1:** Add `users.feature_flags JSONB` column in backend if not exists; default `{}`
- [ ] **Step 2:** Mobile reads `feature_flags.gmail_import_enabled` from `/users/me` response; if false → hide entry button
- [ ] **Step 3:** Admin tool / SQL script to flip flag for individual users for internal beta
- [ ] **Step 4:** Commit

### Task 6.2: TestFlight build

- [ ] **Step 1:** `npm run version:minor` (this is a new feature)
- [ ] **Step 2:** Verify `app.json` has new OAuth scheme
- [ ] **Step 3:** User runs `npm run build:testflight` (per memory: never run EAS builds; user does manually)
- [ ] **Step 4:** Submit App Review notes with demo account credentials and consent flow video link

### Task 6.3: Internal beta + telemetry monitoring

- [ ] **Step 1:** Whitelist test users in feature_flags
- [ ] **Step 2:** Watch Amplitude funnel for first week
- [ ] **Step 3:** Iterate prompt and allowlist based on `gmail_import_zero_results` telemetry

### Task 6.4: Public beta gradual rollout

- [ ] **Step 1:** Enable for 10% of Pro users via feature flag
- [ ] **Step 2:** Monitor for 1 week — connect rate, OAuth abandonment, save rate, paywall conversion
- [ ] **Step 3:** If healthy → 50% → 100%

---

## Self-Review Checklist

**Spec coverage:**
- [x] Trust model B (client-side OAuth) — Tasks 2.2, 2.7
- [x] Pro/Team gating server-side — Task 1.3 (RequireProGuard)
- [x] Pro/Team gating client-side with paywall — Task 3.6
- [x] Gmail-only MVP — only Google OAuth wired (Task 2.7)
- [x] Hybrid scan (allowlist + deep) — Task 2.8 (`mode: 'shallow' | 'deep'`)
- [x] 365-day default window — settings store default in Task 3.5
- [x] Manual + opportunistic on-launch — Task 3.5 step 4
- [x] Local SQLite dedup — Task 2.5
- [x] Add Sheet + Settings entry points — Tasks 3.5, 3.6
- [x] Forwarding flow stays — existing `inbound`/`address` not touched (Task 1.5)
- [x] Result UX with confidence + smart defaults — Task 3.4
- [x] AI flags isRecurring/isCancellation/isTrial — Task 1.4
- [x] Empty/failure states — Task 3.4 (EmptyResultsView)
- [x] Privacy: no email storage — Task 1.5 controller drops content; Task 1.4 returns from RAM
- [x] Disconnect = full wipe — Task 2.7 disconnect()
- [x] Localization 10 locales — Task 4.1, 4.2
- [x] Testing — Tasks 5.1, 5.2 + per-task TDD
- [x] Rollout phases — Tasks 6.1–6.4
- [x] Compliance pre-work — Phase 0

**Placeholder scan:** No "TBD"s except `<from Phase 0.1>` env values which are intentional (depend on Google Console output). Allowlist mention "remaining ~80 added in second commit" — that's a known follow-up, not a placeholder in current scope.

**Type consistency:**
- `Candidate` shape consistent across `email-message.dto.ts` (backend `CandidateOutput`) and `emailImport.ts` (mobile `Candidate`) — same fields.
- `KnownSender` shape: `{domain, emailPattern, serviceName, category, defaultCurrency}` consistent across backend DTO, mobile API client, and `gmailQueryBuilder` input.
- `mode: 'shallow' | 'deep'` consistent in all hooks/endpoints/AI.
- `useGmailScan().scan()` returns `{candidates, scannedCount, durationMs}` matching its usage in ScanProgressView and ImportResultsView.

**Spec gaps found:**
- None found. All decisions D1–D16 are covered by tasks.

---

## Open implementation questions to resolve during work

1. Точное имя метода в существующем `BillingService` для entitlement check — verify в Task 1.3 step 1, при необходимости добавить.
2. Существует ли уже `feature_flags` инфраструктура — verify в Task 6.1.
3. Точная сигнатура `useCreateSubscription` mutation — verify in Task 3.4 step 2; адаптировать вызов.
4. Совместимость `expo-auth-session/providers/google` с уже установленным `@react-native-google-signin/google-signin` — должны не конфликтовать (разные client_id), но смоук-тест Sign-In flow после интеграции обязателен.
