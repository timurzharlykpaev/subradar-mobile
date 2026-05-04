# Gmail Import — Design Spec

**Date:** 2026-05-04
**Status:** Approved (brainstorming complete; pending implementation plan)
**Owner:** Mobile + Backend
**Target release:** R1 = Gmail-only MVP. R2 = Outlook. R3 = onboarding step + background sync (если Apple одобрит).

---

## 1. Context

SubRadar Mobile уже выпущен в App Store и используется реальными пользователями. Текущий флоу добавления подписок: manual / AI text / photo / voice / forwarded email (через `import+{userId}@subradar.ai`). Каждый из них требует отдельного действия пользователя per subscription.

Самый частый запрос — «как мне добавить все подписки сразу, я не помню сколько у меня их». Пользователи имеют в Gmail full source of truth: receipts, renewal notifications, trial reminders. Цель этой фичи — за один OAuth-tap вытащить из Gmail все активные подписки за последний год, прогнать через AI-парсер, и через bulk-confirm screen показать пользователю готовый список к импорту.

Фича — premium (Pro/Team), потому что:
- AI-парсинг с большой recall'ой стоит денег per-user
- CASA-аудит и compliance-нагрузка большие, для масс-маркета фичу нужно монетизировать
- Это сильный upsell-driver для Free → Pro

---

## 2. Goals & Non-goals

### Goals
- Pro/Team пользователь подключает Gmail за один tap → за 10 секунд получает список из всех recurring подписок за 365 дней
- Bulk-confirm flow (как у voice) с возможностью редактировать каждую найденную подписку до сохранения
- Никаких сюрпризов: содержимое писем не сохраняется на наших серверах, refresh-token живёт только на устройстве
- Opportunistic re-scan на запуске приложения (≥14 дней с последнего скана) для нахождения новых подписок без push-нотификаций
- Backward-compatible: старые билды продолжают работать без изменений
- Полная i18n на 10 языках

### Non-goals (R1)
- Outlook / iCloud / Yandex / IMAP — отдельные релизы
- Background scanning (BGAppRefresh) и push-нотификации
- Onboarding-шаг для подключения Gmail
- Parsing PDF-attachments (требует доп. scope)
- Two-way sync (отписка через Gmail)
- Shared mailbox в Team workspace
- Авто-сохранение high-confidence подписок без review (запрещено AI_BEHAVIOR rule 5)

---

## 3. Decisions Log

| # | Decision | Rationale |
|---|---|---|
| D1 | **Trust model = client-side** (B). Refresh-token в Keychain/Keystore, доступ к Gmail с устройства. | Минимальный compliance footprint, письма не покидают устройство как контент. Backend AI получает только snippet'ы в request scope, не сохраняет. |
| D2 | **Plan gating: Pro/Team only.** Free видят кнопку → ProFeatureModal. | Cost control + upsell-канал. |
| D3 | **Team: каждый member подключает свою почту.** Owner не видит чужие письма / находки. | Privacy + compliance: нельзя force-сканировать чужие mailbox. |
| D4 | **R1 = Gmail-only.** Outlook = R2. IMAP/iCloud не делаем. | CASA-аудит — отдельный compliance-проект на provider. iCloud требует App-Specific Password (плохой UX, конфликт с Apple). |
| D5 | **Scan strategy = hybrid** (allowlist + opt-in deep scan). Default window 365 дней. | Allowlist даёт ~80% recall за 5–10 сек и копейки AI-cost. Deep scan — escape valve для нишевых сервисов. Allowlist обновляется server-side без релиза мобилки. |
| D6 | **Sync = manual + opportunistic on-launch.** | App Review safety, нет background permissions. Магия без push. |
| D7 | **Dedup = local SQLite message-id cache + fuzzy name match.** | Privacy: message-id не уезжает на сервер. На disconnect — DROP TABLE. |
| D8 | **Entry points: Add Sheet (4-я опция) + Settings → Connected Accounts.** | Discoverable + не пугает новичков. Onboarding в R1 не трогаем. |
| D9 | **Forwarding flow (`import+xxx@subradar.ai`) остаётся.** Дополняет Gmail — не заменяет. | Покрывает long-tail и Free-юзеров. |
| D10 | **Result UX = confidence visible, smart defaults** (B). High pre-checked, medium pre-checked с warning, low collapsed. | Прозрачно для пользователя, соответствует AI_BEHAVIOR rule 1–5. |
| D11 | **Никакого авто-сейва.** Всё через bulk-confirm review screen. | AI_BEHAVIOR rule 4–5. |
| D12 | **OAuth client для Gmail = отдельный** от Sign-In with Google. | Разные scope-sets, разная Google verification. Не ломает существующий auth. |
| D13 | **Backend `/email-import/parse-bulk`: rate limit 1/min/user, hard cap 800 messages/req, max 6 deep scans/user/month.** | Cost control, abuse prevention. |
| D14 | **Сырое содержимое писем не хранится нигде.** Backend получает snippet → парсит → выбрасывает в request scope. | Минимизация data footprint, честная App Privacy декларация. |
| D15 | **Disconnect = full wipe.** Revoke у Google + clear Keychain + DROP TABLE scanned_messages + reset user gmail flags. Импортированные подписки остаются — теперь они принадлежат юзеру. | Право на удаление (GDPR Art. 17). |
| D16 | **OAuth scope = `gmail.readonly` only.** | Минимальный необходимый, проще проходит Apple Review и Google verification. |

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Mobile (Expo, React Native)                                │
│                                                             │
│  Add Sheet ── tap "Import from Gmail" ──┐                   │
│  Settings ── Connect Gmail ─────────────┤                   │
│                                         ▼                   │
│                                  Consent Screen             │
│                                         │                   │
│                                         ▼                   │
│                              expo-auth-session              │
│                              Google OAuth WebView           │
│                              scope: gmail.readonly          │
│                                         │                   │
│                                         ▼                   │
│              ┌──────────────────────────────────────┐       │
│              │  expo-secure-store: refresh_token     │       │
│              │  RAM only:        access_token        │       │
│              └──────────────────────────────────────┘       │
│                                         │                   │
│                                         ▼                   │
│              GET /email-import/known-senders                │
│                                         │                   │
│                                         ▼                   │
│              gmailClient.listMessages(query, maxResults)    │
│              gmailClient.getMessagesBatch(ids)              │
│                                         │                   │
│                                         ▼                   │
│              scannedMessageStore.filterUnscanned(ids)       │
│                                         │                   │
│                                         ▼                   │
│  ──────────────  POST /email-import/parse-bulk  ────────►   │
└─────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend (NestJS)                                           │
│                                                             │
│  EmailImportController.parseBulk()                          │
│         │                                                   │
│         ├── @RequirePro guard                               │
│         ├── @Throttle(1, 60s)                               │
│         ├── max 800 messages enforce                        │
│         │                                                   │
│         ▼                                                   │
│  AiService.parseBulkEmails(messages, locale)                │
│         │                                                   │
│         ├── OpenAI GPT-4o (existing client)                 │
│         ├── prompt: extract recurring subs only             │
│         ├── flags: isRecurring, isCancellation, isTrial     │
│         ├── confidence per item                             │
│         ├── aggregate by name + amount across messages      │
│         │                                                   │
│         ▼                                                   │
│  Return [Candidate{...}]                                    │
│  ▲ raw email content discarded after function exit          │
│  ▲ NO db write of email content                             │
└─────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Mobile                                                     │
│                                                             │
│  filter: !isRecurring → skip                                │
│  filter: isCancellation → skip (R1)                         │
│                                                             │
│  Bulk Confirm Screen                                        │
│  - existing BulkListStage (extended with confidence chip)   │
│  - existing BulkEditModal                                   │
│  - existing BulkConfirmView                                 │
│                                                             │
│  POST /subscriptions (batch)                                │
│  scannedMessageStore.persist(messageIds, importedSubIds)    │
│  Toast → router.replace('/(tabs)')                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Backend Design

### 5.1 New endpoints

Все под `/email-import/*` (тот же модуль `subradar-backend/src/subscriptions/email-import.controller.ts`).

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/email-import/known-senders` | JWT (Pro+) | Returns `{ senders: KnownSender[], updatedAt }`. Используется мобилкой для построения Gmail query. Кэшируется на устройстве с TTL 24h. |
| `POST` | `/email-import/parse-bulk` | JWT (Pro+), throttle 1/60s, cap 800 messages | Принимает `{ messages: ParseInput[], locale, mode: 'shallow' \| 'deep' }`, возвращает `{ candidates: Candidate[], scannedCount, droppedCount }`. |
| `GET` | `/email-import/status` | JWT | Returns `{ gmailConnected: boolean, lastScanAt: ISO\|null, lastImportCount: number\|null }` для рендера Settings. |
| `POST` | `/email-import/disconnect` | JWT | Идемпотентный — обнуляет user.gmail_* поля. Revoke у Google делает мобилка отдельно. |
| `POST` | `/email-import/log-event` | JWT | Принимает `{ event: string, props: Record<string, primitive> }` без content. Forwards в Mixpanel/PostHog server-side. |

**Существующие** `/email-import/inbound`, `/email-import/address` — без изменений.

### 5.2 DTO contracts

```typescript
// Request
interface ParseInput {
  id: string;            // Gmail message-id
  subject: string;
  snippet: string;       // first ~2KB of body, plain text (HTML stripped client-side)
  from: string;          // sender email
  receivedAt: string;    // ISO date
}

// Response
interface Candidate {
  sourceMessageId: string;
  name: string;
  amount: number;
  currency: string;       // ISO 4217
  billingPeriod: 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY' | 'LIFETIME' | 'ONE_TIME';
  category: Category;
  status: 'ACTIVE' | 'TRIAL';
  nextPaymentDate?: string;
  trialEndDate?: string;
  iconUrl?: string;
  confidence: number;     // 0..1
  isRecurring: boolean;   // false → mobile filters out
  isCancellation: boolean; // true → mobile filters out (R1)
  isTrial: boolean;
  aggregatedFrom: string[]; // list of source message-ids if dedupe'd from multiple
}
```

### 5.3 Schema migration

```sql
-- Migration: 2026-05-04-gmail-import.sql

ALTER TABLE users
  ADD COLUMN gmail_connected_at TIMESTAMP NULL,
  ADD COLUMN gmail_last_scan_at TIMESTAMP NULL,
  ADD COLUMN gmail_last_import_count INT NULL,
  ADD COLUMN gmail_deep_scans_this_month INT NOT NULL DEFAULT 0,
  ADD COLUMN gmail_deep_scan_month VARCHAR(7) NULL; -- 'YYYY-MM' for reset logic

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
  UNIQUE(domain, email_pattern)
);

CREATE INDEX idx_known_senders_active ON known_billing_senders(active) WHERE active = TRUE;
```

**Seed data:** ~150 записей в отдельном файле миграции (Netflix, Spotify, Apple Music, Apple One, iCloud+, YouTube Premium, Adobe CC, Adobe Express, Microsoft 365, OpenAI/ChatGPT Plus, Anthropic/Claude Pro, Notion, Figma, Zoom, Slack, GitHub, Vercel, Cloudflare, AWS, Google One, Google Workspace, DigitalOcean, Linear, Asana, Monday, ClickUp, 1Password, Dropbox, Bitwarden, ProtonMail, ProtonVPN, NordVPN, ExpressVPN, Heroku, Stripe, Render, Supabase, Hostinger, GoDaddy, Namecheap, и т.д.).

### 5.4 AI service extension

В `subradar-backend/src/ai/ai.service.ts`:

```typescript
async parseBulkEmails(
  messages: ParseInput[],
  locale: string,
  mode: 'shallow' | 'deep'
): Promise<Candidate[]> {
  // 1. Build prompt with explicit instructions to:
  //    - Skip one-time purchases (set isRecurring=false)
  //    - Detect cancellations (set isCancellation=true)
  //    - Detect trials (set isTrial=true with trialEndDate)
  //    - Return confidence per item
  //    - Reply in stable JSON schema
  // 2. Call OpenAI gpt-4o with structured output (JSON mode)
  // 3. Aggregate: group by lowercase(name) + currency, pick latest amount.
  //    aggregatedFrom = list of source message-ids
  // 4. Return Candidate[]
}
```

Prompt-инструкция включает таблицу примеров (Netflix monthly receipt → ACTIVE, MONTHLY; «Your trial ends Apr 5» → TRIAL with trialEndDate; «Subscription cancelled» → isCancellation=true; «You bought a movie $4.99» → isRecurring=false).

### 5.5 Guards и rate limits

**Важно:** в текущем backend Pro-gating только клиентский — все AI-эндпоинты (parse-text, parse-screenshot, и т.д.) защищены только `JwtAuthGuard`, без проверки тарифа. Для Gmail-import это неприемлемо: cost-per-call высокий, и Free user может просто дернуть `/parse-bulk` напрямую в обход мобильного paywall.

**Часть этой работы:** создать `RequireProGuard` в `subradar-backend/src/auth/guards/require-pro.guard.ts`, использовать его на всех premium-эндпоинтах (для начала — только `/email-import/parse-bulk`, в R2 расширить на parse-text/parse-screenshot чтобы закрыть существующую дыру).

```typescript
// subradar-backend/src/auth/guards/require-pro.guard.ts (NEW)
@Injectable()
export class RequireProGuard implements CanActivate {
  constructor(private readonly billingService: BillingService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const status = await this.billingService.getEntitlementStatus(req.user.id);
    if (!status.isPro && !status.isTeam) {
      throw new HttpException('Pro plan required', HttpStatus.PAYMENT_REQUIRED);
    }
    return true;
  }
}
```

```typescript
@Controller('email-import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class EmailImportController {
  @Post('parse-bulk')
  @UseGuards(RequireProGuard)
  @Throttle({ default: { limit: 1, ttl: 60_000 } })
  async parseBulk(@Body() dto: ParseBulkDto, @Request() req) {
    if (dto.messages.length > 800) throw new PayloadTooLargeException();
    if (dto.mode === 'deep') {
      await this.checkAndIncrementDeepScanQuota(req.user.id); // max 6/month
    }
    // ... call ai service
  }
}
```

Returns 402 Payment Required для Free → мобилка должна обрабатывать это как «Pro plan required» и показывать paywall (на случай race condition между checkout и API call).

### 5.6 Backward compatibility

- Все эндпоинты — новые. Существующие unchanged.
- `known_billing_senders` обновляется server-side без релиза мобилки — старые билды auto-получают новых биллеров.
- Никаких изменений в response существующих эндпоинтов (`POST /subscriptions`, `GET /subscriptions`, `POST /ai/parse-text`, etc.).
- Никакого ужесточения validation на existing DTO.
- Новые поля в `users` table — все nullable, существующие writes не ломают.

---

## 6. Mobile Design

### 6.1 New files

```
src/
├── api/
│   └── emailImport.ts                    # axios client for /email-import/*
├── hooks/
│   ├── useGmailAuth.ts                   # OAuth flow
│   ├── useGmailScan.ts                   # orchestrates scan
│   └── useEmailImportStatus.ts           # GET /email-import/status (TanStack)
├── services/
│   ├── gmail/
│   │   ├── gmailClient.ts                # Gmail REST wrapper (list, get, batch)
│   │   ├── gmailTokenStore.ts            # expo-secure-store
│   │   └── gmailQueryBuilder.ts          # builds `from:(...) newer_than:Yd`
│   └── scannedMessageStore.ts            # local SQLite (expo-sqlite)
├── components/
│   ├── email-import/
│   │   ├── ConnectGmailScreen.tsx
│   │   ├── ScanProgressView.tsx
│   │   ├── ImportResultsView.tsx
│   │   ├── DeepScanPromptCard.tsx
│   │   ├── EmptyResultsView.tsx
│   │   ├── GmailConnectedRow.tsx
│   │   └── OpportunisticBanner.tsx
│   └── add-subscription/
│       └── GmailImportEntryButton.tsx
└── utils/
    └── emailImportTelemetry.ts

app/
└── email-import/
    ├── connect.tsx          # consent + OAuth trigger
    ├── scanning.tsx         # progress overlay
    ├── review.tsx           # bulk confirm
    └── settings.tsx         # Connected Accounts subscreen
```

### 6.2 Hooks contracts

```typescript
function useGmailAuth(): {
  isConnected: boolean;
  isAuthenticating: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAccessToken(): Promise<string>;  // refresh if expired
};

function useGmailScan(): {
  scan(opts: { mode: 'shallow' | 'deep' }): Promise<ScanResult>;
  silentScan(): Promise<{ newCandidates: Candidate[] }>;  // for opportunistic
  progress: { stage: ScanStage; current: number; total: number } | null;
  cancel(): void;
};

function useEmailImportStatus(): UseQueryResult<{
  gmailConnected: boolean;
  lastScanAt: string | null;
  lastImportCount: number | null;
}>;
```

### 6.3 Local SQLite

```sql
CREATE TABLE IF NOT EXISTS scanned_messages (
  message_id TEXT PRIMARY KEY,
  scanned_at INTEGER NOT NULL,
  imported_subscription_id TEXT NULL,
  source_sender TEXT NULL
);
CREATE INDEX idx_scanned_at ON scanned_messages(scanned_at);
```

DB-файл: `${FileSystem.documentDirectory}gmail_import.db`. Не бэкапится в iCloud (set `NSURLIsExcludedFromBackupKey` через `expo-file-system`).

### 6.4 Settings UI

Settings → новый раздел «Connected Accounts»:

```
┌─────────────────────────────────────────────┐
│ Connected Accounts                          │
│                                             │
│ [G] Gmail                          [✓]     │
│     Last scan: 3 days ago                   │
│     Auto-scan when I open the app  [ON]    │
│     Scan window: Last year       ▾          │
│     ┌──────────────────────────────┐        │
│     │  Scan now                    │        │
│     │  Disconnect                  │        │
│     └──────────────────────────────┘        │
│                                             │
│ ── Or forward emails ──────────────         │
│ Forward any subscription receipt to:        │
│ import+abc123@subradar.ai          [Copy]   │
│                                             │
└─────────────────────────────────────────────┘
```

### 6.5 Opportunistic re-scan logic

В `app/_layout.tsx` после auth bootstrap:

```typescript
useEffect(() => {
  if (!gmailConnected || !isPro) return;
  if (!settingsStore.emailImport.autoScanEnabled) return;
  const last = await getLastScanAt();
  const fourteenDaysAgo = Date.now() - 14 * 24 * 3600_000;
  if (last && last > fourteenDaysAgo) return;

  silentScan({ mode: 'shallow' })
    .then(({ newCandidates }) => {
      if (newCandidates.length > 0) {
        appStore.setOpportunisticBanner({ candidates: newCandidates });
      }
    })
    .catch(reportError);
}, [gmailConnected, isPro]);
```

`OpportunisticBanner` — sticky banner на top of dashboard с кнопками `Review` (→ `/email-import/review`) и `Dismiss`.

### 6.6 Add Sheet integration

В `AddSubscriptionSheet.tsx` добавляем 4-ю карточку:

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  Manual      │  AI Text     │  Photo       │  Gmail       │
│  ✏️           │  💬          │  📷          │  📧 PRO      │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

Tap для Free → `ProFeatureModal` с `feature: 'gmail_import'`.

### 6.7 Plan gating server-side

Хотя клиент проверяет `isPro` локально, бэкенд **дублирует** проверку через `RequireProGuard`. Это критично — никакого trust to client.

### 6.8 Component reuse (without new abstractions)

| Existing | Adapted as |
|---|---|
| `BulkListStage` | Add optional `confidenceLevel` + `sourceChip` props (defaults preserve old voice flow) |
| `BulkEditModal` | Reused as-is for per-item edit |
| `BulkConfirmView` | Reused for final confirm |
| `ProFeatureModal` | New case `gmail_import` |
| `useEffectiveAccess` | Reused for Pro check |
| `useTheme` / colors | All inline styles use `colors.*` |
| `i18n` (react-i18next) | New namespace `emailImport` |
| `aiApi` axios instance | Reused with auth interceptor |
| `reportError` | Sentry capture (no email content) |

---

## 7. Privacy & Security

### 7.1 Storage map

| Artifact | Where | Lifetime | Encryption |
|---|---|---|---|
| Gmail OAuth `refresh_token` | iOS Keychain / Android Keystore | Until disconnect | OS-level hardware-backed |
| Gmail `access_token` | RAM only | TTL ~1h | n/a |
| Scanned message-ids | Local SQLite | Until uninstall or disconnect | n/a (not content) |
| Raw email content | **Nowhere** — discarded after parse | 0 | n/a |
| Snippet (subject + 2KB body) | Backend RAM in request scope only | ~2-5 sec | TLS in transit |
| Parsed subscriptions | PostgreSQL (regular subs table) | Until user deletes | DB-level encryption at rest |
| Message-id ↔ sub-id mapping | **Local SQLite only** | Until uninstall | n/a |
| OAuth audit log | Backend `users.gmail_*` (timestamps only) | Until account delete | n/a |

**Key invariant:** backend никогда не знает, какие конкретно письма были сканированы или импортированы. Видит только final subscriptions (как при ручном вводе) + timestamps.

### 7.2 Consent screen

Полноэкранный экран перед OAuth. На обоих платформах. Все 10 локалей.

```
[Header] Connect Gmail to find your subscriptions

[What we'll do]
• Scan your Gmail for billing receipts (read-only access)
• Use AI to identify recurring subscriptions
• Show you a list to review before saving

[What we'll never do]
• Never read your personal emails or conversations
• Never store your emails on our servers
• Never send anything from your Gmail
• Never share your data with third parties

[Your control]
• Disconnect at any time in Settings
• Disconnecting wipes all our access immediately
• You'll review every subscription before it's saved

[Primary] Connect Gmail
[Secondary] Not now

[Footer link] Privacy Policy
```

После tap OAuth WebView. Затем — opt screen «Ready to scan?» с кнопкой `Start scan`.

### 7.3 Disconnect flow

```typescript
async disconnect() {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${refreshToken}`, { method: 'POST' });
  await SecureStore.deleteItemAsync('gmail_refresh_token');
  await scannedMessageStore.dropTable();
  await api.post('/email-import/disconnect');
  queryClient.invalidateQueries({ queryKey: ['email-import-status'] });
  trackEvent('gmail_disconnected', { reason: 'user_initiated' });
}
```

Импортированные подписки **не удаляются** — они принадлежат юзеру, как любые другие.

### 7.4 GDPR

- App Privacy декларация:
  - Data Linked to You: None (от Gmail)
  - Data Used to Track You: None
  - Data Not Linked to You: «Email metadata processed transiently for subscription parsing — not stored»
- Privacy Policy секция «Gmail Integration» с retention policy и DPO контактом
- User Right to Access: при экспорте данных мы возвращаем только subscriptions (никакого email content для возврата)
- User Right to Erasure: disconnect = wipe; account delete = additionally удаляет `users.gmail_*` поля

### 7.5 Backend observability

- Logs: `userId, message_count, deep_scan_flag, duration` — без content
- Sentry breadcrumbs: stage transitions only
- Alert: AI parse failure rate > 30% за 1 час
- Alert: AI cost > $50 / day
- No raw emails в logs, никогда

### 7.6 Access matrix

| Role | Sees option | Can connect | Can see other's mailbox/findings |
|---|---|---|---|
| Free user | ✅ (with paywall) | ❌ → upsell | n/a |
| Pro user | ✅ | ✅ own | n/a |
| Team member | ✅ | ✅ own | ❌ |
| Team admin/owner | ✅ | ✅ own | ❌ — только final subscriptions, добавленные member'ом в shared workspace |

Server-side enforcement: `userId` from JWT === `userId` для всех Gmail-related ops.

### 7.7 Explicit non-doings

- Не используем Gmail data для рекламы / ML обучения / любой аналитики кроме парсинга текущего юзера
- Не сохраняем content нигде, даже временно на S3 / DO Spaces
- Не делимся Gmail data с RevenueCat / Sentry / Mixpanel (на content уровне)
- Не сканируем Sent / Drafts / Trash — только Inbox + Promotions
- Не запрашиваем scopes за пределами `gmail.readonly`. Future PDF parsing — отдельный consent.

---

## 8. Localization

Новый namespace `emailImport` в `src/locales/{lang}.json` для всех 10 локалей: en, ru, de, es, fr, ja, ko, pt, zh, kk.

~85 ключей под секциями: `entry`, `consent.willDo`, `consent.willNot`, `consent.control`, `scan`, `results`, `empty`, `error`, `success`, `banner`, `settings`, `forwarding`, `paywall`.

**Translation workflow:**
1. EN-версия канон, пишем первой
2. Юр.ревью EN consent screen и privacy text (если есть юрист)
3. RU — human translation (носитель)
4. Top-3 markets (DE, ES — по выбору) — human translation
5. Остальные 6 — AI translation с explicit пометкой в metadata `translatedAutomatically: true`
6. Smoke-проверка на 3 локалях вручную перед public beta

---

## 9. Testing Strategy

### 9.1 Unit (Jest)

**Mobile (`src/__tests__/`):**
- `gmailQueryBuilder.test.ts` — построение query, escape, max length truncation
- `scannedMessageStore.test.ts` — SQLite roundtrip, dedup, disconnect-wipe
- `emailImportApi.test.ts` — axios client с моком на `/parse-bulk`
- `useGmailScan.test.ts` — оркестрация, фильтрация isRecurring, агрегация edge cases, abort
- `gmailTokenStore.test.ts` — secure-store roundtrip, refresh flow
- `OpportunisticBanner.test.tsx` — show/hide rules
- `ConnectGmailScreen.test.tsx` — все 10 локалей рендерятся без сломанных интерполяций

**Backend (`subradar-backend/src/.../*.spec.ts`):**
- `email-import.controller.spec.ts` — расширить: parse-bulk happy/edge, rate limit hit, plan gating, cap enforcement
- `ai.service.spec.ts` — расширить: `parseBulkEmails` с фикстурами реальных писем, агрегация Netflix×12, isRecurring detection, isCancellation, isTrial

### 9.2 Integration

- Mobile: mock Gmail API через `nock`/`msw` — list + get + 50-batch
- Backend: full e2e на `/email-import/parse-bulk` с mock OpenAI

### 9.3 E2E (Maestro)

- `gmail-import-happy.yaml`: tap → consent → mock OAuth → scan progress → review → save → toast → dashboard
- `gmail-import-cancel-mid-scan.yaml`: cancel during fetch
- `gmail-import-deep-scan.yaml`: shallow → no findings → deep → findings
- `gmail-import-disconnect.yaml`: connected → settings → disconnect → confirm → check wiped
- `gmail-import-paywall-free.yaml`: Free user → tap → paywall → upgrade flow

### 9.4 Manual QA checklist (`docs/superpowers/checklists/`)

- Real Gmail на iPhone + Android
- Token revoke в `myaccount.google.com` → проверка `tokenRevoked` экрана
- Permission denied на consent → no crash
- Slow network (Network Link Conditioner 3G) — прогресс корректный
- Account switch → старый scanned-cache не leak
- Background → foreground посередине скана
- Smoke на 3 non-Latin локалях (ru, ja, ko)
- Real email-фикстуры разных языков (русский Yandex.Plus, japanese Apple Music)
- App backgrounding во время OAuth WebView → recovery
- Multiple Gmail accounts on device → правильный выбор

### 9.5 Backend integration

- Postman/Bruno collection с фикстурами для каждого endpoint
- Load test `/parse-bulk` 800 messages — проверить cap и timeout
- Stress test rate limit — confirm 60s window

---

## 10. Rollout Plan

### Phase 0 — Pre-work (start NOW, parallel to coding)
- Подача на Google OAuth verification + CASA Tier 2 (4–8 недель wall time)
- Создать отдельный Gmail OAuth client_id в Google Cloud Console (не путать с Sign-In)
- Обновить Privacy Policy (production + landing) с Gmail Integration секцией
- Юр.ревью EN consent копии
- Обновить App Privacy в App Store Connect и Google Play Console (заранее, иначе Apple Review зацепит)
- Подготовить demo Gmail-аккаунт для App / Google review с реальными billing emails

### Phase 1 — Backend MVP (week 1–2)
- Migration + `known_billing_senders` seed (~150 entries)
- Endpoints: `/parse-bulk`, `/known-senders`, `/status`, `/disconnect`, `/log-event`
- AI service: `parseBulkEmails` с агрегацией и flags, prompt с примерами
- Backend tests (unit + e2e)
- Deploy за feature flag `EMAIL_IMPORT_ENABLED=false` в prod (whitelist test users)

### Phase 2 — Mobile MVP (week 2–4)
- Все компоненты, хуки, навигация
- Локализация на 10 языков
- Unit-тесты + 2 Maestro flows (happy + disconnect)
- TestFlight build с feature flag

### Phase 3 — Internal beta (week 4–5)
- TestFlight для команды + 5–10 friendly Pro юзеров
- Сбор реальных email-фикстур через Sentry / Mixpanel (без content)
- Итерации над allowlist и AI prompt

### Phase 4 — Public beta (week 5–6)
- Включить feature flag для 10% Pro юзеров (gradual rollout)
- Мониторинг: connect rate, scan duration, AI parse error rate, paywall conversion, OAuth abandonment
- Если метрики ок → 50% → 100% за 2 недели

### Phase 5 — Post-launch (week 7+)
- Outlook (если CASA + Microsoft verification закрыты)
- Onboarding step 5 — A/B test Gmail в первом запуске
- Background sync (если Apple одобрит) — push «новая подписка нашлась»
- Deep-scan optimization (structured JSON output из gpt-4o)

---

## 11. Analytics

```
gmail_import_entry_viewed         { source: 'add_sheet' | 'settings' | 'banner' }
gmail_import_paywall_shown        { source }
gmail_import_paywall_upgrade_click
gmail_import_consent_viewed
gmail_import_consent_accepted
gmail_import_consent_skipped
gmail_import_oauth_started
gmail_import_oauth_success
gmail_import_oauth_cancelled       { stage: 'webview' | 'permission_denied' }
gmail_import_oauth_failed          { errorCode }
gmail_import_scan_started          { mode: 'shallow' | 'deep' | 'opportunistic' }
gmail_import_scan_progress         { fetched, total }   # throttled to once per 5 sec
gmail_import_scan_completed        { found, durationMs, mode }
gmail_import_scan_failed           { stage, errorCode }
gmail_import_review_viewed         { count, highConfidence, lowConfidence }
gmail_import_item_unchecked        { confidence }
gmail_import_item_edited
gmail_import_save_clicked          { selectedCount }
gmail_import_save_completed        { savedCount }
gmail_import_save_partial_failure  { savedCount, failedCount }
gmail_import_zero_results
gmail_import_deep_scan_clicked
gmail_import_disconnected          { reason: 'user' | 'token_revoked' }
gmail_import_banner_shown          { count }
gmail_import_banner_review_click
gmail_import_banner_dismissed
```

**Funnel metrics:**
- `entry_view → paywall_shown` (Free discovery)
- `consent_viewed → consent_accepted` (consent UX качество)
- `oauth_started → oauth_success` (OAuth friction)
- `scan_completed → save_completed` (review friction)
- `scan_completed.found > 0 / total scans` (recall качество)
- `paywall_shown → paywall_upgrade_click → checkout_completed` (Pro conversion through this feature)

---

## 12. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| CASA-аудит затягивается | High | Blocks release | Стартуем Phase 0 параллельно Phase 1. Backup: hard-cap 100 пользователей с unverified-баннером для бета-теста. |
| Apple App Review отказ | Medium | Delay 1–2 wks | Demo-аккаунт, видео-демо consent flow, готовый ответ на review с обоснованием scope |
| AI стоимость взрывается | Medium | $$ | Hard cap 800 msg/scan, 6 deep-scans/month/user, alert на $50/day, daily cost dashboard |
| Allowlist неполный → low recall | High at start | Low perceived value | Активное пополнение по телеметрии «not_found»; deep scan как escape valve; обновление server-side |
| Утечка refresh-token из Keychain | Low | Severe | Hardware-backed Keychain, явный disconnect-wipe, audit подключений в Settings, Sentry alert на anomalies |
| AI hallucinates fake subscription | Medium | Юзер импортит мусор | Confidence threshold + review screen + isRecurring flag + telemetry false positives + iterate on prompt |
| Gmail API rate limits | Low | Скан тормозит | Batch API (50 messages per call) + exponential backoff |
| Юзер revoked в Google | Medium | Юзер не понимает что произошло | Detect 401 → show «Reconnect» CTA с понятной копией |
| Старые билды видят rotten endpoints | Low | Backward-compat | Все эндпоинты additive с самого начала, существующие unchanged |
| OAuth client конфликт с Sign-In | Medium | Сломаем существующий login | Отдельный client_id для Gmail scope (Phase 0) |
| Privacy Policy translation ошибка | Medium | Compliance-риск | Юр.ревью EN → human translation на топ-3 → AI translation на остальные с явной пометкой |
| Gmail prompt-injection через subject | Low | AI выдаёт мусор | Strict JSON output mode + schema validation после AI; ignore non-conforming responses |
| OAuth WebView в iOS закрывается случайно | Medium | Юзер теряет flow | Resume-логика в `useGmailAuth` + сохранение last-used scope |

---

## 13. Open Questions (resolve in implementation plan)

1. ~~Какой analytics SDK?~~ **Resolved:** `@amplitude/analytics-react-native` уже стоит в мобилке. Используем его для всех `gmail_import_*` events. Backend `/log-event` остаётся как fallback для server-side событий (например, rate-limit hit).
2. Есть ли юрист для review Privacy Policy + consent копии, или формулируем самостоятельно?
3. Кто seed'ит `known_billing_senders` (~150 entries) — отдельная engineering задача (script + JSON file) или продакт ручками через admin?
4. Где взять demo-Gmail-аккаунт для App Store / Google review с реальными billing emails (нужен будет минимум 5–10 receipts от разных сервисов)?
5. Существующий feature-flag механизм в мобилке — endpoint, статика в `app.json`, или в RevenueCat audience? Если нет — какой выбираем? **Предложение по умолчанию:** server-side flag в `users.feature_flags` JSONB column + admin tool; мобилка опрашивает через `/users/me`. Простой и backward-compatible.
6. Существующий backend Pro-gating дыра: текущие AI-эндпоинты (`/ai/parse-text`, `/ai/parse-screenshot`, `/ai/wizard`) защищены только JWT, без проверки тарифа. Для Gmail-import создаём `RequireProGuard`. **Решить в R2:** применить тот же guard ко всем premium AI-эндпоинтам, чтобы закрыть дыру? (Может вызвать regression если есть юзеры на старых билдах, которые до этого тихо проходили.)

---

## 14. Files referenced

- [src/components/AIWizard.tsx](src/components/AIWizard.tsx) — pattern for bulk add wizard
- [src/components/ai-wizard/BulkListStage.tsx](src/components/ai-wizard/BulkListStage.tsx) — to be extended with confidence + source chip
- [src/components/ai-wizard/BulkEditModal.tsx](src/components/ai-wizard/BulkEditModal.tsx) — reused as-is
- [src/components/AddSubscriptionSheet.tsx](src/components/AddSubscriptionSheet.tsx) — add 4th entry button
- [src/components/ProFeatureModal.tsx](src/components/ProFeatureModal.tsx) — add `gmail_import` case
- [src/hooks/useEffectiveAccess.ts](src/hooks/useEffectiveAccess.ts) — Pro check
- [subradar-backend/src/subscriptions/email-import.controller.ts](../../../../subradar-backend/src/subscriptions/email-import.controller.ts) — extend with new endpoints
- [subradar-backend/src/ai/ai.service.ts](../../../../subradar-backend/src/ai/ai.service.ts) — add `parseBulkEmails`
- [docs/AI_BEHAVIOR.md](../../AI_BEHAVIOR.md) — confidence rules, fallback rules
- [docs/API_CONTRACTS.md](../../API_CONTRACTS.md) — to be updated with new endpoints
- [docs/MOBILE_SCREENS.md](../../MOBILE_SCREENS.md) — add screens 7a (Connect Gmail), 7b (Scanning), 7c (Review Imports), 15a (Connected Accounts settings)
- [docs/NAVIGATION_MAP.md](../../NAVIGATION_MAP.md) — add `email-import/*` routes
