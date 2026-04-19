# Subscription System Refactor — Design Spec

**Date:** 2026-04-19
**Scope:** subradar-backend + subradar-mobile
**Status:** Approved (full design, user confirmed 2026-04-19)
**Repos touched:** `subradar-backend` (NestJS), `subradar-mobile` (React Native + Expo)

---

## 1. Цели и контекст

Аудит показал критические проблемы в подписочной системе SubRadar:

**Mobile:**
- Hardcoded test RevenueCat key как fallback (src/hooks/useRevenueCat.ts:25-27) — риск попадания test key в prod.
- Race condition: `loginRevenueCat()` вызывается до завершения `configureRevenueCat()` (app/_layout.tsx:143-159).
- Опасный fallback `isPro = activeKeys.length > 0` (src/hooks/useRevenueCat.ts:157) — любое entitlement даёт Pro.
- Локальные вычисления `nextPaymentDate`, `graceDaysLeft`, `shouldShowDoublePay` зависят от systemDate, могут расходиться с бэком.
- Restore Purchases только на paywall.
- Subscriptions кэшируются в AsyncStorage (потенциальное tampering).

**Backend:**
- `POST /workspace` создаётся без проверки plan capability (`canCreateOrg` игнорируется) — free-юзер может создать Team.
- Нет rate limiting на `/billing/checkout`, `/billing/invite`, `/billing/cancel`, `/billing/sync-revenuecat`, `/billing/trial`.
- Pro Invite race condition: owner может отменить подписку между валидацией и записью invitee.
- Trial activation не имеет transaction lock.
- Разбросанные по файлам условия по состояниям подписки — нет формального state machine.
- Нет reconciliation с RC API: если webhook не доехал — state расходится до следующего event.
- Нет outbox pattern для исходящих побочных эффектов (amplitude, telegram).
- Audit trail для workspace отсутствует.

**Цели рефакторинга:**
1. Бэкенд — единственный источник истины для effective access. Мобилка только рендерит.
2. Формализовать состояния и переходы через `BillingStateMachine`.
3. Защитить все billing endpoints (auth + rate limit + plan capability).
4. Обеспечить надёжность webhook'ов (outbox + reconciliation cron).
5. Унифицировать trials (backend + RC intro в одной таблице).
6. Единая UI-консистентность через `useEffectiveAccess` и `BannerRenderer`.
7. Observability: events в Amplitude, Sentry breadcrumbs, Grafana dashboard.

**Вне scope:**
- Android billing (Google Play).
- Lemon Squeezy deprecation.
- Promo codes, family sharing, pause subscription.

**Backward compat:** отсутствует. Приложение ещё не в сторе, ломаем контракт `/billing/me` сразу.

---

## 2. Архитектурный обзор

**Backend — новые модули:**
- `billing/state-machine/` — pure functions, формальные переходы состояний.
- `billing/effective-access/` — единственный резолвер `EffectiveAccess`.
- `billing/reconciliation/` — cron + RC API client для сверки.
- `billing/trials/` — унифицированный trial system с `user_trials` таблицей.
- `billing/outbox/` — `outbox_events` таблица + worker для исходящих действий.
- `common/guards/plan.guard.ts` — `@RequirePlanCapability(...)` декоратор.

**Backend — меняется:**
- `GET /billing/me` — полностью новая форма ответа.
- Webhook handlers (RC + LS) переведены на state machine.
- `POST /workspace` защищён `PlanGuard`.
- Rate limiter на billing endpoints (через `@nestjs/throttler` с Redis storage).
- Pro invite — transaction + pessimistic lock.
- Trial endpoint — backend-driven через `TrialsService.activate()`.

**Mobile — меняется/новое:**
- `useEffectiveAccess` — тонкая обёртка над `/billing/me`, никаких локальных вычислений.
- `src/utils/nextPaymentDate.ts` — удаляется.
- `BannerRenderer` — единый компонент, читает `bannerPriority` из ответа.
- `useRevenueCat` — fail-fast в prod на test key, async init с awaited configure, исправленный `isPro`.
- `RestorePurchasesButton` — переиспользуется на paywall и Settings.
- Paywall — pending receipt в SecureStore, retry UX с модалкой.
- Product IDs читаются из `billing.products` вместо хардкода.
- `subscriptionsStore` — убираем AsyncStorage persist.

**Поток данных:**
```
Apple/RC → RC Webhook → BillingStateMachine.transition()
                     → User + UserTrial + Workspace update (одна транзакция)
                     → Audit log
                     → Outbox enqueue (amplitude, telegram, fcm)
Outbox worker (10s cron) → Amplitude / Telegram / FCM

Reconciliation cron (1h) → "подозрительные" юзеры
                        → RC API /subscribers/{appUserId}
                        → BillingStateMachine.reconcile()
                        → fix + audit + alert при расхождении

Client → GET /billing/me → EffectiveAccessResolver
                       → { effective, ownership, dates, flags, 
                           banner, limits, actions, products, serverTime }
```

---

## 3. Data Model

### 3.1 Изменения в `users`
- `plan` → enum `'free' | 'pro' | 'organization'` (фиксируем типом через миграцию).
- `billing_status` (новое) → enum `'active' | 'cancel_at_period_end' | 'billing_issue' | 'grace_pro' | 'grace_team' | 'free'`.
- `current_period_end` → обязательно заполняется при `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, не только `CANCELLATION`.
- `billing_source` → enum `'revenuecat' | 'lemon_squeezy' | null`.
- `invited_by_user_id` (новое) → uuid nullable, FK на `users(id)`, используется для Pro invite tracking.
- `current_period_start` (новое) → timestamptz nullable, нужен для расчёта nextPaymentDate на бэке.
- Удаляемые поля (через отдельную последующую миграцию через 1 месяц): `trial_used`, `trial_start_date`, `trial_end_date`.

### 3.2 Новая таблица `user_trials`
```
id                      uuid PRIMARY KEY
user_id                 uuid UNIQUE REFERENCES users(id) ON DELETE CASCADE
source                  enum('revenuecat_intro'|'backend'|'lemon_squeezy')
plan                    enum('pro'|'organization')
started_at              timestamptz NOT NULL
ends_at                 timestamptz NOT NULL
consumed                boolean NOT NULL DEFAULT true
original_transaction_id text NULL
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()
```
Unique(`user_id`) гарантирует один trial per user. Активация — только через transaction + pessimistic_write lock.

### 3.3 Новая таблица `outbox_events`
```
id              uuid PRIMARY KEY
type            varchar(64) NOT NULL      -- 'amplitude.track'|'telegram.alert'|'fcm.push'
payload         jsonb NOT NULL
status          enum('pending'|'processing'|'done'|'failed') NOT NULL DEFAULT 'pending'
attempts        int NOT NULL DEFAULT 0
last_error      text NULL
next_attempt_at timestamptz NOT NULL DEFAULT now()
created_at      timestamptz DEFAULT now()
processed_at    timestamptz NULL

INDEX idx_outbox_pending (status, next_attempt_at) WHERE status IN ('pending','processing')
```

### 3.4 Изменения `webhook_events`
Существующая таблица уже корректна с `UNIQUE(provider, event_id)` для идемпотентности. Добавить колонки и индекс для reconciliation:
```
ALTER TABLE webhook_events ADD COLUMN user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE webhook_events ADD COLUMN error   text NULL;
ALTER TABLE webhook_events ADD COLUMN event_type varchar(64) NULL;

CREATE INDEX idx_webhook_events_user_error 
  ON webhook_events (user_id, processed_at) 
  WHERE error IS NOT NULL;
```
`user_id` заполняется в webhook handler после резолва по `app_user_id`. `error` заполняется при ошибке обработки (до rollback claim). Это нужно чтобы reconciliation мог найти юзеров с failed webhooks за сутки.

### 3.5 Индексы для reconciliation
```
INDEX idx_users_reconciliation_candidates 
  ON users (billing_source, current_period_end) 
  WHERE billing_source = 'revenuecat' 
    AND billing_status NOT IN ('grace_pro','grace_team','free')
```

---

## 4. BillingStateMachine

Модуль `src/billing/state-machine/` — pure TypeScript, без зависимостей от репозиториев.

### 4.1 Типы
```ts
export type BillingState =
  | 'free'
  | 'active'
  | 'cancel_at_period_end'
  | 'billing_issue'
  | 'grace_pro'
  | 'grace_team';

export interface UserBillingSnapshot {
  userId: string;
  plan: 'free' | 'pro' | 'organization';
  state: BillingState;
  billingSource: 'revenuecat' | 'lemon_squeezy' | null;
  billingPeriod: 'monthly' | 'yearly' | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  graceExpiresAt: Date | null;
  graceReason: 'team_expired' | 'pro_expired' | null;
  billingIssueAt: Date | null;
}

export type BillingEvent =
  | { type: 'RC_INITIAL_PURCHASE'; plan: 'pro'|'organization'; period: 'monthly'|'yearly'; periodStart: Date; periodEnd: Date }
  | { type: 'RC_RENEWAL'; periodStart: Date; periodEnd: Date }
  | { type: 'RC_PRODUCT_CHANGE'; newPlan: 'pro'|'organization'; period: 'monthly'|'yearly'; periodStart: Date; periodEnd: Date }
  | { type: 'RC_CANCELLATION'; periodEnd: Date }
  | { type: 'RC_UNCANCELLATION' }
  | { type: 'RC_EXPIRATION' }
  | { type: 'RC_BILLING_ISSUE' }
  | { type: 'TEAM_OWNER_EXPIRED'; memberHasOwnSub: boolean }
  | { type: 'TEAM_MEMBER_REMOVED' }
  | { type: 'GRACE_EXPIRED' }
  | { type: 'LS_SUBSCRIPTION_CREATED'; plan; period; periodEnd }
  | { type: 'LS_SUBSCRIPTION_UPDATED'; plan; period; periodEnd }
  | { type: 'LS_SUBSCRIPTION_CANCELLED' };

export function transition(
  current: UserBillingSnapshot,
  event: BillingEvent,
): UserBillingSnapshot;  // throws on invalid transition

export function reconcile(
  current: UserBillingSnapshot,
  rcSubscriber: RCSubscriber,
): UserBillingSnapshot;  // self-heal from full RC snapshot
```

### 4.2 Матрица валидных переходов
| From \ Event | RC_INITIAL | RC_RENEWAL | RC_PRODUCT_CHANGE | RC_CANCEL | RC_UNCANCEL | RC_EXPIRATION | RC_BILLING_ISSUE | TEAM_OWNER_EXPIRED | GRACE_EXPIRED |
|---|---|---|---|---|---|---|---|---|---|
| `free` | → `active` | ✗ | ✗ | ✗ | ✗ | no-op | ✗ | → `grace_team` | no-op |
| `active` | ✗ | → `active` | → `active` | → `cancel_at_period_end` | ✗ | → `grace_pro` | → `billing_issue` | → `grace_team` (if no own sub) | ✗ |
| `cancel_at_period_end` | ✗ | ✗ | ✗ | ✗ | → `active` | → `grace_pro` | → `billing_issue` | → `grace_team` | ✗ |
| `billing_issue` | ✗ | → `active` | ✗ | → `cancel_at_period_end` | ✗ | → `grace_pro` | no-op | → `grace_team` | ✗ |
| `grace_pro` | → `active` | ✗ | ✗ | ✗ | ✗ | no-op | ✗ | ✗ | → `free` |
| `grace_team` | → `active` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | → `free` |

Любой невалидный переход → `InvalidTransitionError` → audit log + telegram alert. Это ловит баги, а не нормальный flow.

### 4.3 Интеграция
- Webhook handlers вызывают `transition()`, затем `BillingRepo.applySnapshot()` (в транзакции).
- Reconciliation cron вызывает `reconcile()`.
- `WorkspaceService` при remove member или owner expiration вызывает `transition()` с `TEAM_OWNER_EXPIRED` / `TEAM_MEMBER_REMOVED`.
- `grace-period.cron.ts` вызывает `transition()` с `GRACE_EXPIRED` для каждого подходящего юзера.

---

## 5. `/billing/me` контракт

### 5.1 Новая форма ответа
```jsonc
{
  "effective": {
    "plan": "pro",
    "source": "own",
    "state": "active",
    "billingPeriod": "monthly"
  },
  "ownership": {
    "hasOwnPaidPlan": true,
    "isTeamOwner": false,
    "isTeamMember": false,
    "teamOwnerId": null,
    "workspaceId": null
  },
  "dates": {
    "currentPeriodStart": "2026-04-19T10:00:00Z",
    "currentPeriodEnd": "2026-05-19T10:00:00Z",
    "nextPaymentDate": "2026-05-19T10:00:00Z",
    "graceExpiresAt": null,
    "graceDaysLeft": null,
    "trialEndsAt": null,
    "billingIssueStartedAt": null
  },
  "flags": {
    "cancelAtPeriodEnd": false,
    "hasBillingIssue": false,
    "trialEligible": false,
    "shouldShowDoublePay": false,
    "degradedMode": false,
    "hiddenSubscriptionsCount": 0
  },
  "banner": {
    "priority": "none",
    "payload": {}
  },
  "limits": {
    "subscriptions": { "used": 7, "limit": null },
    "aiRequests":    { "used": 12, "limit": 200, "resetAt": "2026-05-01T00:00:00Z" },
    "canCreateOrg":  false,
    "canInvite":     true
  },
  "actions": {
    "canStartTrial": false,
    "canCancel": true,
    "canRestore": true,
    "canUpgradeToYearly": true,
    "canInviteProFriend": true
  },
  "products": {
    "pro":  { "monthly": "io.subradar.mobile.pro.monthly",  "yearly": "io.subradar.mobile.pro.yearly" },
    "team": { "monthly": "io.subradar.mobile.team.monthly", "yearly": "io.subradar.mobile.team.yearly" }
  },
  "serverTime": "2026-04-19T14:32:11Z"
}
```

### 5.2 Banner priority (строго один)
Порядок (сверху важнее):
1. `billing_issue` — платёж провалился
2. `grace` — подписка истекла, дней до downgrade
3. `expiration` — активная, кончается ≤ 7 дней
4. `double_pay` — Pro + Team member (не owner)
5. `annual_upgrade` — monthly Pro, можно сэкономить
6. `win_back` — раньше был Pro, сейчас Free
7. `none`

`banner.payload` зависит от priority (пример: `{ daysLeft: 5, reason: 'team_expired' }` для `grace`).

### 5.3 EffectiveAccessResolver алгоритм
1. Load `User` (лок не нужен — read).
2. Load `UserTrial`, `Workspace` (если owner), `WorkspaceMember` (если member).
3. Load подписок пользователя count (для `degradedMode` logic).
4. Валидировать `user.billing_status` через `BillingStateMachine.currentStateIsValid(user)` — если нет, audit log + attempt self-heal.
5. Вычислить `effective.plan` по приоритету:
   - Team owner с активной Team-подпиской → `organization` / `own`
   - Team member + owner активен → `organization` / `team`
   - Active/cancel_at_period_end own sub → `user.plan` / `own`
   - Trial active (`userTrial.endsAt > now`) → `trial.plan` / `trial`
   - `grace_pro` → `pro` / `grace_pro`
   - `grace_team` → `organization` / `grace_team`
   - Else → `free` / `free`
6. Посчитать `dates` — `graceDaysLeft = ceil((graceExpiresAt - now) / 1day)`, `nextPaymentDate = current_period_end` если `!cancelAtPeriodEnd`.
7. Посчитать `banner.priority` + `payload`.
8. Вычислить `limits` из `PLANS[effective.plan]` config.
9. Вычислить `actions` (canStartTrial = `!userTrial.consumed && !hasOwnPaidPlan && effective.plan==='free'` и т.д.).

### 5.4 Кеш
Redis, ключ `billing:me:{userId}`, TTL 60s. Инвалидация — событийная:
- Любой webhook event для userId
- Изменение workspace membership
- Manual cancel / restore
- Trial activation
Клиент всё равно будет ходить часто (refetch on focus), но кеш отсекает нагрузку на DB.

---

## 6. Webhook reliability + reconciliation

### 6.1 Входящий webhook flow
```ts
// Billing controller
@Post('revenuecat-webhook')
async handleRC(@Body() body, @Headers('authorization') auth) {
  this.verifyBearer(auth);
  const event = body.event;
  const claimed = await this.billing.claimWebhookEvent('revenuecat', event.id);
  if (!claimed) return { ok: true, duplicate: true };
  try {
    await this.billing.processRCEvent(event);  // transaction inside
    return { ok: true };
  } catch (err) {
    await this.billing.rollbackWebhookClaim('revenuecat', event.id);
    throw err;  // 5xx → RC повторит
  }
}
```
`processRCEvent` делает:
1. Найти юзера по `app_user_id`.
2. Загрузить текущий `UserBillingSnapshot`.
3. Мап RC event → `BillingEvent`.
4. `const next = stateMachine.transition(current, event)`.
5. В транзакции: `userRepo.applySnapshot(next)` + `userTrialRepo.upsert(...)` + `auditRepo.log(...)` + `outboxRepo.enqueue(...)`.
6. Инвалидация Redis кеша.

### 6.2 Outbox worker
```ts
@Injectable()
export class OutboxWorker {
  @Cron('*/10 * * * * *')  // every 10s
  async tick() {
    const batch = await this.outbox.claimBatch(50);  // select for update skip locked
    await Promise.allSettled(batch.map(e => this.process(e)));
  }

  private async process(event: OutboxEvent) {
    try {
      switch (event.type) {
        case 'amplitude.track': await this.amplitude.track(event.payload); break;
        case 'telegram.alert':  await this.telegram.send(event.payload); break;
        case 'fcm.push':        await this.fcm.send(event.payload); break;
      }
      await this.outbox.markDone(event.id);
    } catch (err) {
      const nextAttempt = event.attempts >= 10 ? null : exponentialBackoff(event.attempts);
      await this.outbox.markFailed(event.id, err.message, nextAttempt);
    }
  }
}
```
`claimBatch` использует `FOR UPDATE SKIP LOCKED` чтобы несколько инстансов бэка не обрабатывали одни события.

### 6.3 Reconciliation cron
```ts
@Cron('0 * * * *')  // hourly
async reconcile() {
  if (!this.cfg.get('BILLING_RECONCILIATION_ENABLED', false)) return;
  const suspicious = await this.findSuspicious(200);
  for (const user of suspicious) {
    try {
      const rcSub = await this.rcClient.getSubscriber(user.id);
      const current = this.snapshotFromUser(user);
      const next = stateMachine.reconcile(current, rcSub);
      if (!deepEqual(current, next)) {
        await this.applyAndAudit(user, next, 'reconciliation_fix');
        await this.outbox.enqueue('telegram.alert', { 
          type: 'reconciliation_mismatch', 
          userId: user.id,
          diff: buildDiff(current, next)
        });
      }
      await sleep(300);  // rate limit
    } catch (err) {
      this.logger.error(`Reconcile failed for ${user.id}: ${err.message}`);
    }
  }
}
```
`findSuspicious` SQL:
```sql
SELECT id, plan, billing_status, billing_source, current_period_end, grace_period_end
FROM users
WHERE billing_source = 'revenuecat'
  AND (
    (current_period_end IS NOT NULL 
     AND current_period_end < now() - interval '10 minutes'
     AND billing_status NOT IN ('grace_pro','grace_team','free'))
    OR id IN (
      SELECT DISTINCT user_id FROM webhook_events
      WHERE provider='revenuecat' 
        AND processed_at > now() - interval '24 hours'
        AND error IS NOT NULL
    )
  )
LIMIT $1;
```

### 6.4 RC API client
`src/billing/revenuecat/rc-client.service.ts`:
```ts
class RevenueCatClient {
  private http: AxiosInstance;
  
  constructor(cfg: ConfigService) {
    this.http = axios.create({
      baseURL: 'https://api.revenuecat.com/v1',
      headers: { Authorization: `Bearer ${cfg.get('REVENUECAT_API_KEY')}` },
      timeout: 10_000,
    });
    axiosRetry(this.http, { retries: 3, retryCondition: e => e.response?.status >= 500 });
  }
  
  async getSubscriber(appUserId: string): Promise<RCSubscriber> {
    const { data } = await this.http.get(`/subscribers/${encodeURIComponent(appUserId)}`);
    return data.subscriber;
  }
}
```
Circuit breaker при >50% failure rate за минуту — fail fast, не бомбить RC.

### 6.5 Health endpoint
```
GET /health/billing (admin bearer auth)
```
Возвращает metrics для Grafana. Alerts в Telegram:
- webhook failure rate > 1% за час
- reconciliation mismatch count > 0 за час
- outbox failed count > 0
- outbox pending > 100 (worker stuck)

---

## 7. Security + trials

### 7.1 PlanGuard
`src/common/guards/plan.guard.ts`:
```ts
export const RequirePlanCapability = (cap: keyof PlanConfig) => 
  SetMetadata(PLAN_CAP_KEY, cap);

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private users: UsersService,
    private effectiveAccess: EffectiveAccessResolver,
  ) {}
  
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const cap = this.reflector.get<keyof PlanConfig>(PLAN_CAP_KEY, ctx.getHandler());
    if (!cap) return true;
    const req = ctx.switchToHttp().getRequest();
    const access = await this.effectiveAccess.resolve(req.user.id);
    if (!access.limits[cap]) {
      throw new ForbiddenException(`Requires ${cap} — upgrade your plan`);
    }
    return true;
  }
}
```
Применение:
```ts
@Post()
@UseGuards(JwtAuthGuard, PlanGuard)
@RequirePlanCapability('canCreateOrg')
create(...) { ... }
```

### 7.2 Rate limiting
```ts
// billing.module.ts
ThrottlerModule.forRootAsync({
  useFactory: () => ({
    throttlers: [{ ttl: 60_000, limit: 20 }],  // default
    storage: new ThrottlerStorageRedisService(redis),
  }),
})
```
На endpoint'ах:
```ts
@Throttle({ default: { ttl: 60_000, limit: 5 } })
@Post('checkout') ...

@Throttle({ default: { ttl: 60_000, limit: 10 } })
@Post('sync-revenuecat') ...

@Throttle({ default: { ttl: 60_000, limit: 3 } })
@Post('cancel') ...

@Throttle({ default: { ttl: 60_000, limit: 5 } })
@Post('invite') ...

@Throttle({ default: { ttl: 60_000, limit: 1 } })
@Post('trial') ...
```
Webhook endpoints — без throttle. Превышения логируются в `AuditService`.

### 7.3 Pro Invite transaction
```ts
async activateProInvite(ownerId: string, inviteeEmail: string): Promise<void> {
  await this.dataSource.transaction(async (m) => {
    const owner = await m.findOne(User, {
      where: { id: ownerId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!['pro', 'organization'].includes(owner.plan)) {
      throw new ForbiddenException('Only Pro/Team users can invite');
    }
    if (owner.cancelAtPeriodEnd) {
      throw new BadRequestException('Cannot invite while cancelled');
    }
    if (owner.proInviteeEmail) {
      throw new ConflictException('You already have an active invitee');
    }
    const email = inviteeEmail.toLowerCase().trim();
    const invitee = await m.findOne(User, {
      where: { email },
      lock: { mode: 'pessimistic_write' },
    });
    if (!invitee) throw new NotFoundException(`User ${email} not found`);
    if (invitee.id === owner.id) throw new BadRequestException('Cannot invite yourself');
    if (invitee.plan !== 'free') throw new ConflictException('User already on paid plan');
    
    invitee.plan = 'pro';
    invitee.billingSource = null;
    invitee.invitedByUserId = owner.id;
    owner.proInviteeEmail = email;
    await m.save([owner, invitee]);
    await this.audit.log({ 
      userId: owner.id, action: 'billing.pro_invite_activated', 
      resourceId: invitee.id, metadata: { email: maskEmail(email) }
    });
    await this.outbox.enqueue('amplitude.track', {
      event: 'billing.pro_invite_sent',
      userId: owner.id,
      properties: { inviteeId: invitee.id }
    });
  });
}
```
`downgradeInviteeIfEligible` использует ту же транзакционную схему.

### 7.4 TrialsService
```ts
@Injectable()
export class TrialsService {
  constructor(private dataSource: DataSource, private audit: AuditService, private outbox: OutboxService) {}
  
  async activate(userId: string, source: TrialSource, plan: 'pro'|'organization'): Promise<UserTrial> {
    return this.dataSource.transaction(async (m) => {
      const existing = await m.findOne(UserTrial, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing) throw new ConflictException('Trial already used');
      
      const user = await m.findOne(User, { where: { id: userId } });
      if (user.plan !== 'free') throw new BadRequestException('Already on paid plan');
      
      const trial = m.create(UserTrial, {
        userId,
        source,
        plan,
        startedAt: new Date(),
        endsAt: addDays(new Date(), 7),
        consumed: true,
      });
      await m.save(trial);
      await this.audit.log({ userId, action: 'billing.trial_activated', metadata: { source, plan } });
      await this.outbox.enqueue('amplitude.track', {
        event: 'billing.trial_started',
        userId,
        properties: { source, plan }
      });
      return trial;
    });
  }
  
  async status(userId: string): Promise<UserTrial | null> {
    return this.userTrialRepo.findOne({ where: { userId } });
  }
}
```
RC webhook с `is_trial_period=true` → `TrialsService.activate(userId, 'revenuecat_intro', plan)` после `transition()`.

### 7.5 Workspace audit
Добавить `AuditService.log(...)` в:
- `WorkspaceService.create()` → `workspace.created`
- `WorkspaceService.delete()` → `workspace.deleted`
- `WorkspaceService.inviteMember()` → `workspace.member_invited`
- `WorkspaceService.joinByCode()` → `workspace.member_joined`
- `WorkspaceService.removeMember()` → `workspace.member_removed`
- `WorkspaceService.generateInviteCode()` → `workspace.invite_code_generated`

Каждый event также → `outbox.enqueue('amplitude.track', ...)`.

---

## 8. Mobile — изменения

### 8.1 RC SDK hardening
`src/hooks/useRevenueCat.ts`:
```ts
const RC_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_KEY_IOS ?? process.env.EXPO_PUBLIC_REVENUECAT_KEY;
const RC_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_KEY_ANDROID ?? process.env.EXPO_PUBLIC_REVENUECAT_KEY;

function resolveKey(): string {
  const key = Platform.OS === 'ios' ? RC_KEY_IOS : RC_KEY_ANDROID;
  if (!key) {
    const msg = 'RevenueCat key not configured';
    if (!__DEV__) throw new Error(msg);
    console.warn(msg);
    return 'test_PLACEHOLDER';  // only DEV
  }
  if (!__DEV__ && key.startsWith('test_')) {
    Sentry.captureMessage('RevenueCat test key in production build', 'fatal');
    throw new Error('Invalid RC config: test key in production');
  }
  return key;
}

let configurePromise: Promise<void> | null = null;

export function configureRevenueCat(): Promise<void> {
  if (configurePromise) return configurePromise;
  configurePromise = (async () => {
    const apiKey = resolveKey();
    await Purchases.configure({ apiKey });
    if (__DEV__) await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  })();
  return configurePromise;
}

export async function loginRevenueCat(userId: string): Promise<void> {
  await configureRevenueCat();
  await Purchases.logIn(userId);
}

export async function logoutRevenueCat(): Promise<void> {
  await configureRevenueCat();
  await Purchases.logOut();
}
```
Опасный fallback убран:
```ts
const isPro = activeKeys.some(k => /^(pro|team)$/i.test(k));
const isTeam = activeKeys.some(k => /^team$/i.test(k));
```

`app/_layout.tsx` DataLoader:
```ts
useEffect(() => {
  (async () => {
    try {
      if (!isAuthenticated) {
        await logoutRevenueCat();
        return;
      }
      const userId = useAuthStore.getState().user?.id;
      if (userId) await loginRevenueCat(userId);
    } catch (e) {
      Sentry.captureException(e, { tags: { source: 'rc_init' } });
    }
  })();
}, [isAuthenticated]);
```

### 8.2 useEffectiveAccess
```ts
// src/hooks/useEffectiveAccess.ts
export function useEffectiveAccess() {
  const { data: billing } = useBillingStatus();
  if (!billing) return null;
  return {
    plan: billing.effective.plan,
    source: billing.effective.source,
    state: billing.effective.state,
    billingPeriod: billing.effective.billingPeriod,
    isPro: billing.effective.plan !== 'free',
    isTeamOwner: billing.ownership.isTeamOwner,
    isTeamMember: billing.ownership.isTeamMember,
    hasOwnPaidPlan: billing.ownership.hasOwnPaidPlan,
    currentPeriodEnd: billing.dates.currentPeriodEnd ? new Date(billing.dates.currentPeriodEnd) : null,
    nextPaymentDate: billing.dates.nextPaymentDate ? new Date(billing.dates.nextPaymentDate) : null,
    graceDaysLeft: billing.dates.graceDaysLeft,
    graceReason: billing.flags.graceReason,
    trialEndsAt: billing.dates.trialEndsAt ? new Date(billing.dates.trialEndsAt) : null,
    flags: billing.flags,
    limits: billing.limits,
    actions: billing.actions,
    banner: billing.banner,
    products: billing.products,
  };
}
```
Удаляемые файлы:
- `src/utils/nextPaymentDate.ts` и соответствующий тест
- Локальные вычисления в `useEffectiveAccess.ts` (graceDaysLeft, shouldShowDoublePay)

### 8.3 BannerRenderer
`src/components/BannerRenderer.tsx`:
```tsx
export function BannerRenderer() {
  const access = useEffectiveAccess();
  if (!access) return null;
  const { priority, payload } = access.banner;
  switch (priority) {
    case 'billing_issue': return <BillingIssueBanner payload={payload} />;
    case 'grace':         return <GraceBanner payload={payload} />;
    case 'expiration':    return <ExpirationBanner payload={payload} />;
    case 'double_pay':    return <DoublePayBanner payload={payload} />;
    case 'annual_upgrade': return <AnnualUpgradeBanner payload={payload} />;
    case 'win_back':      return <WinBackBanner payload={payload} />;
    default: return null;
  }
}
```
Ставится на:
- `app/(tabs)/index.tsx` (под header)
- `app/(tabs)/settings.tsx` (в подписочной секции)
- `app/(tabs)/subscriptions.tsx` (вверху списка)

Существующие баннеры (`GraceBanner`, `BillingIssueBanner`, etc.) переписываются на приём `payload` prop.

### 8.4 RestorePurchasesButton
`src/components/RestorePurchasesButton.tsx` — переиспользуется. В Settings показывается в секции «Подписка» всегда (даже для Pro).

### 8.5 Paywall
```ts
// app/paywall.tsx
async function purchaseFlow(pkg: PurchasesPackage) {
  await SecureStore.setItemAsync('pending_receipt', pkg.product.identifier);
  const ok = await purchasePackage(pkg);
  if (!ok) {
    await SecureStore.deleteItemAsync('pending_receipt');
    return;
  }
  let syncOk = false;
  for (let attempt = 0; attempt < 3 && !syncOk; attempt++) {
    analytics.track('sync_retry_attempt', { attempt: attempt + 1 });
    try {
      await billingApi.syncRevenueCat(pkg.product.identifier);
      syncOk = true;
      analytics.track('sync_retry_succeeded', { attempt: attempt + 1 });
    } catch (e) {
      if (attempt < 2) await sleep(1500 * (attempt + 1));
    }
  }
  if (!syncOk) {
    analytics.track('sync_retry_exhausted');
    showRetryModal();  // модалка с кнопкой "Проверить ещё раз"
    return;
  }
  await SecureStore.deleteItemAsync('pending_receipt');
  await queryClient.refetchQueries({ queryKey: ['billing'] });
}
```
При старте приложения в `DataLoader`:
```ts
useEffect(() => {
  (async () => {
    const pending = await SecureStore.getItemAsync('pending_receipt');
    if (pending && isAuthenticated) {
      try {
        await billingApi.syncRevenueCat(pending);
        await SecureStore.deleteItemAsync('pending_receipt');
        queryClient.invalidateQueries({ queryKey: ['billing'] });
      } catch { /* retry next launch */ }
    }
  })();
}, [isAuthenticated]);
```

### 8.6 Product IDs и цены
Paywall читает `access.products` вместо хардкода. Если `access.products` не пришёл (старый сервер или офлайн) — loading state 10 сек, затем «Цены временно недоступны» + retry.

Fallback цены в `app/paywall.tsx:167-174` — удаляются.

### 8.7 Subscriptions store
`src/stores/subscriptionsStore.ts` — убираем AsyncStorage persist. Zustand остаётся для in-memory state, но без `persist` middleware. TanStack Query кеширует в памяти, invalidates через focus refresh и interval (60s).

Оффлайн UX: компонент `OfflineBanner` показывает «Нет соединения, данные могут быть устаревшими».

---

## 9. Analytics, observability, tests

### 9.1 Backend events (через outbox)
- `billing.subscription_purchased` — после `INITIAL_PURCHASE`
- `billing.subscription_renewed` — после `RENEWAL`
- `billing.subscription_cancelled` — после `CANCELLATION`
- `billing.subscription_expired` — после `EXPIRATION`
- `billing.product_changed` — после `PRODUCT_CHANGE`
- `billing.billing_issue_started` / `billing.billing_issue_resolved`
- `billing.grace_started` / `billing.grace_expired` / `billing.grace_recovered`
- `billing.trial_started` / `billing.trial_converted` / `billing.trial_expired_no_convert`
- `billing.pro_invite_sent` / `billing.pro_invite_downgraded`
- `workspace.created` / `workspace.member_joined` / `workspace.member_left`
- `billing.reconciliation_mismatch`

Поля: `userId`, `planBefore`, `planAfter`, `source`, `amount`, `currency`, `productId`, `serverTimestamp`.

### 9.2 Mobile events (дополнения)
- `sync_retry_attempt` / `sync_retry_succeeded` / `sync_retry_exhausted`
- `restore_from_settings_tapped`
- `banner_shown` (priority, source)
- `banner_action_tapped`
- `pending_receipt_recovered`

### 9.3 Sentry
- Теги: `billing.webhook.rc`, `billing.webhook.ls`, `billing.reconciliation`, `billing.purchase.flow`, `billing.state_transition`
- Breadcrumbs перед каждым state transition с `from`, `to`, `event`
- Fatal: test RC key in production, invalid state transition

### 9.4 Tests

**Backend (Jest + testcontainers):**
- `state-machine.spec.ts` — table-driven, все переходы из матрицы + все невалидные → throw
- `effective-access.spec.ts` — 30+ комбинаций `(plan, billingSource, teamMembership, trial, grace, count)` → expected response
- `webhook-rc.spec.ts` — idempotency (один event дважды = одна запись), invalid signature = 401, each event type happy path, rollback при ошибке
- `webhook-ls.spec.ts` — то же для Lemon Squeezy
- `reconciliation.spec.ts` — подозрительные юзера → RC mock → fix + alert
- `trials.spec.ts` — concurrent activate → только один успешен
- `pro-invite.spec.ts` — race condition test, lock test
- `plan-guard.spec.ts` — free-юзер получает 403 на workspace create
- `throttler.spec.ts` — превышение лимитов
- `outbox-worker.spec.ts` — retry + backoff + deadletter

**Mobile (Jest + RNTL):**
- `useEffectiveAccess.spec.ts` — снепшоты для каждой формы `/billing/me`
- `BannerRenderer.spec.tsx` — каждый priority → правильный компонент
- `useRevenueCat.spec.ts` — init order, test key detection, isPro вычисление
- `paywall.spec.tsx` — retry logic, pending receipt recovery

**E2E (Maestro):**
- Trial flow (новый юзер → paywall → start trial → Pro features)
- Purchase flow (paywall → sandbox purchase → sync → Pro badge)
- Restore flow (logout → login → restore → Pro восстановлен)
- Team invite flow (owner create → member join → member видит Team)

---

## 10. Deployment plan

Приложение не в сторе — ломаем контракт без compat. Порядок деплоя:

### 10.1 Backend (одна волна)
1. Мигрировать DB:
   - `ALTER users ADD billing_status, invited_by_user_id, current_period_start`
   - Backfill `billing_status` из `plan + cancelAtPeriodEnd + gracePeriodEnd` (script)
   - `CREATE TABLE user_trials` + backfill из `trial_start_date/trial_end_date`
   - `CREATE TABLE outbox_events`
   - Индексы для reconciliation
   - Миграция обратима (down methods для каждой)
2. Деплой новой версии:
   - Новый `/billing/me` контракт
   - `BillingStateMachine`, `EffectiveAccessResolver`
   - Webhook handlers на state machine
   - `OutboxWorker` включён
   - `ReconciliationCron` с `BILLING_RECONCILIATION_ENABLED=false` (первые 24ч только observe-mode через лог)
   - `PlanGuard`, rate limiting, Pro invite lock, TrialsService
3. После 24ч в observe — включить `BILLING_RECONCILIATION_ENABLED=true`.
4. Через месяц — удалить `trial_used/trial_start_date/trial_end_date` колонки.

### 10.2 Mobile (сразу после backend)
1. Обновить `src/api/billing.ts` под новый контракт.
2. `useEffectiveAccess`, `BannerRenderer`, RC hardening, restore на settings.
3. Удалить `nextPaymentDate.ts`, AsyncStorage persist в subscriptionsStore.
4. EAS build → новый dev build для тестирования.
5. Production build после тестирования (EAS делает пользователь вручную — согласно memory).

### 10.3 Monitoring первая неделя
- Grafana dashboard `/health/billing`
- Telegram alerts: webhook failure rate > 1%, reconciliation mismatch > 0, outbox failed > 0, outbox pending > 100
- Daily audit: сравнение audit_logs с amplitude events

### 10.4 Rollback
- Backend: миграции обратимы; предыдущий деплой восстанавливается через CI за минуты; Redis кеш очищается (`FLUSHDB billing:*`).
- Mobile: `eas update --branch production --message "rollback"` возвращает prev bundle.

---

## 11. Файлы — создаются / меняются / удаляются

### Backend (subradar-backend)

**Создаются:**
- `src/billing/state-machine/state-machine.ts`
- `src/billing/state-machine/types.ts`
- `src/billing/state-machine/transitions.ts`
- `src/billing/state-machine/reconcile.ts`
- `src/billing/state-machine/__tests__/state-machine.spec.ts`
- `src/billing/effective-access/effective-access.service.ts`
- `src/billing/effective-access/banner-priority.ts`
- `src/billing/effective-access/__tests__/effective-access.spec.ts`
- `src/billing/reconciliation/reconciliation.cron.ts`
- `src/billing/reconciliation/reconciliation.service.ts`
- `src/billing/revenuecat/rc-client.service.ts`
- `src/billing/trials/trials.service.ts`
- `src/billing/trials/trials.controller.ts`
- `src/billing/trials/entities/user-trial.entity.ts`
- `src/billing/outbox/outbox.service.ts`
- `src/billing/outbox/outbox.worker.ts`
- `src/billing/outbox/entities/outbox-event.entity.ts`
- `src/billing/health/health.controller.ts`
- `src/common/guards/plan.guard.ts`
- `src/common/decorators/require-plan-capability.decorator.ts`
- `db/migrations/N_add_billing_status_and_fields.ts`
- `db/migrations/N_create_user_trials.ts`
- `db/migrations/N_create_outbox_events.ts`
- `db/migrations/N_backfill_billing_status.ts`
- `db/migrations/N_backfill_user_trials.ts`
- `db/migrations/N_add_reconciliation_indexes.ts`
- `db/migrations/N_alter_webhook_events_add_user_error.ts`

**Меняются:**
- `src/billing/billing.controller.ts` — новый `/billing/me`, throttle, delegirovanie state machine
- `src/billing/billing.service.ts` — переход на state machine, outbox
- `src/billing/billing.module.ts` — новые провайдеры, ThrottlerModule
- `src/users/entities/user.entity.ts` — новые поля, удалить trial поля (после backfill)
- `src/workspace/workspace.controller.ts` — `PlanGuard` + `@RequirePlanCapability('canCreateOrg')`
- `src/workspace/workspace.service.ts` — вызовы `AuditService.log()`, outbox events
- `src/billing/grace-period.cron.ts` — переход на state machine, batch update
- `src/main.ts` — никаких изменений (raw body уже настроен)

**Удаляются:**
- Прямые вызовы `telegram.send()` / `amplitude.track()` из сервисов — заменяются на `outbox.enqueue()`

### Mobile (subradar-mobile)

**Создаются:**
- `src/components/BannerRenderer.tsx`
- `src/components/RestorePurchasesButton.tsx` (вынести из paywall)
- `src/hooks/__tests__/useEffectiveAccess.spec.ts`
- `src/components/__tests__/BannerRenderer.spec.tsx`

**Меняются:**
- `src/hooks/useBilling.ts` — новый тип ответа
- `src/hooks/useEffectiveAccess.ts` — тонкая обёртка
- `src/hooks/useRevenueCat.ts` — fail-fast, async init, исправленный isPro
- `src/api/billing.ts` — новый BillingMeResponse type
- `src/types/billing.ts` — новые типы
- `app/_layout.tsx` — async DataLoader, pending receipt recovery
- `app/paywall.tsx` — retry с pending receipt в SecureStore, analytics events, products from bg
- `app/(tabs)/index.tsx` — BannerRenderer вместо разрозненных баннеров
- `app/(tabs)/settings.tsx` — BannerRenderer + RestorePurchasesButton
- `app/(tabs)/subscriptions.tsx` — BannerRenderer
- `src/components/GraceBanner.tsx`, `BillingIssueBanner.tsx`, `ExpirationBanner.tsx`, `DoublePayBanner.tsx`, `WinBackBanner.tsx`, `AnnualUpgradeBanner.tsx` — принимают `payload` prop
- `src/stores/subscriptionsStore.ts` — убрать persist
- `src/services/analytics.ts` — новые events (sync_retry_*, restore_from_settings_tapped, banner_*)

**Удаляются:**
- `src/utils/nextPaymentDate.ts`
- `src/__tests__/nextPaymentDate.test.ts`
- Локальные вычисления `graceDaysLeft`, `shouldShowDoublePay`, `shouldShowBillingIssue`

---

## 12. Вне scope / follow-ups

- Android Google Play billing (отдельный проект).
- Lemon Squeezy deprecation если решимся.
- Promo codes, discount offers.
- Family sharing.
- Pause subscription (Apple feature).
- Migration tool для существующих prod-юзеров (если появятся до релиза).
- Admin dashboard для billing overview.
- Автоматическое ceremony для увольнения team member при EXPIRATION owner (сейчас идёт через grace).
