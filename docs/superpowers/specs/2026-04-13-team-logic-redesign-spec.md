# Team Subscription Logic Redesign — Spec

**Goal:** Исправить полностью сломанную логику Team membership: участники не получают Pro доступ при входе, не сбрасываются лимиты при выходе owner-а, нет grace period, нет UI degradation после grace, нет защиты от double-pay при Pro+Team.

**Business model:** Owner платит Team ($9.99/mo), до 10 членов получают Pro доступ через team. Если у member был свой Pro — он сохраняется. После expiration/leave — 7 дней grace, потом UI degradation (locked placeholder cards) для стимула вернуться.

**Constraints:**
- Не удалять подписки из БД никогда (только скрывать в UI)
- Не менять App Store/RevenueCat configuration
- Не ломать существующих платных юзеров (миграция должна быть backward-compatible)
- Все тексты через i18n (10 локалей)
- Отвечать пользователю на русском

---

## Архитектура: новый "effective access" слой

Текущая проблема: код везде смотрит на `User.plan` напрямую, что не учитывает team membership и grace period.

**Решение:** Новый метод `BillingService.getEffectiveAccess(user)` — единственный источник правды о том, что юзеру доступно ПРЯМО СЕЙЧАС.

```typescript
interface EffectiveAccess {
  plan: 'free' | 'pro' | 'organization';  // план для лимитов
  source: 'own' | 'team' | 'grace_team' | 'grace_pro' | 'free';
  graceUntil?: Date;             // если в grace
  graceDaysLeft?: number;        // удобство для UI
  isTeamOwner: boolean;
  isTeamMember: boolean;          // включая owner
  hasOwnPro: boolean;             // есть собственная RC подписка
  workspaceId?: string;
  workspaceExpiringAt?: Date;     // дата soft delete если истёк
}
```

**Алгоритм:**
1. Найти `WorkspaceMember` где `userId = user.id, status = ACTIVE`
2. Если найден — найти `Workspace`, проверить план owner:
   - Если owner имеет активный team plan (`User.plan === 'organization'` или есть active RC entitlement) → `{ plan: 'organization', source: 'team', isTeamMember: true }`
   - Если owner expired → перейти к шагу 3 (своя проверка juzera)
3. Проверить собственный план:
   - `User.billingSource === 'revenuecat'` и `cancelAtPeriodEnd === false` → `{ plan: User.plan, source: 'own', hasOwnPro: true }`
   - Trial active (`trialEndDate > now`) → `{ plan: 'pro', source: 'own' }`
4. Проверить grace:
   - `User.gracePeriodEnd > now` → `{ plan: 'pro', source: 'grace_*', graceUntil: ... }`
5. Default → `{ plan: 'free', source: 'free' }`

**Где используется (заменяет `getEffectivePlan`):**
- `getBillingInfo` — возвращает effective plan + новые поля
- `subscription-limit.guard.ts`
- `consumeAiRequest`
- `analysis/plan.guard.ts`

---

## Database changes

### User entity — новые поля

```typescript
@Column({ type: 'timestamp', nullable: true })
gracePeriodEnd: Date | null;

@Column({ type: 'varchar', length: 20, nullable: true })
gracePeriodReason: 'team_expired' | 'pro_expired' | null;
```

**Миграция:** Add nullable columns, default null. No data migration needed.

### Workspace entity — новое поле

```typescript
@Column({ type: 'timestamp', nullable: true })
expiredAt: Date | null;  // когда owner перестал платить
```

**Миграция:** Add nullable column.

**Whitelist update:** Добавить `'gracePeriodEnd'`, `'gracePeriodReason'` в `users.service.ts` ALLOWED_KEYS (Task 1 audit fix паттерн).

---

## Backend: Cascade logic

### 1. RC EXPIRATION webhook handler (`billing.service.ts`)

Текущий код только меняет owner plan на free. Добавить:

```typescript
case 'EXPIRATION': {
  // Existing: downgrade user
  user.plan = 'free';
  user.billingPeriod = null;
  user.billingSource = null;
  user.cancelAtPeriodEnd = false;
  user.currentPeriodEnd = null;
  // NEW: start grace period
  user.gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  user.gracePeriodReason = 'pro_expired';
  await this.usersService.save(user);

  // NEW: cascade to team members if user was team owner
  await this.handleTeamOwnerExpiration(user.id);
  break;
}
```

### 2. New method `handleTeamOwnerExpiration(ownerId)`

```typescript
async handleTeamOwnerExpiration(ownerId: string): Promise<void> {
  const workspace = await this.workspaceRepo.findOne({ where: { ownerId } });
  if (!workspace) return;

  // Mark workspace as expired (soft delete after 30 days)
  workspace.expiredAt = new Date();
  await this.workspaceRepo.save(workspace);

  // Find all active members
  const members = await this.workspaceMemberRepo.find({
    where: { workspaceId: workspace.id, status: ACTIVE },
    relations: ['user'],
  });

  for (const member of members) {
    if (member.userId === ownerId) continue; // owner already handled
    const u = member.user;
    // Skip if member has own Pro (revenuecat active)
    if (u.billingSource === 'revenuecat' && !u.cancelAtPeriodEnd) continue;
    // Start grace for member
    u.gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    u.gracePeriodReason = 'team_expired';
    await this.usersService.save(u);
  }
}
```

### 3. Voluntary leave team

В `WorkspaceService.leaveTeam(userId, workspaceId)`:
```typescript
// existing leave logic (delete WorkspaceMember)
const user = await this.usersService.findById(userId);
// Skip grace if member has own Pro
if (user.billingSource !== 'revenuecat') {
  user.gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  user.gracePeriodReason = 'team_expired';
  await this.usersService.save(user);
}
```

### 4. Owner manually cancels (`cancelSubscription`)

После downgrade owner-а — вызвать `handleTeamOwnerExpiration(userId)`.

### 5. Cron jobs (`grace-period.cron.ts` — новый)

```typescript
@Cron('5 0 * * *')  // 00:05 daily
async resetExpiredGrace() {
  const now = new Date();
  const users = await this.userRepo.find({
    where: { gracePeriodEnd: LessThan(now) },
  });
  for (const u of users) {
    u.gracePeriodEnd = null;
    u.gracePeriodReason = null;
    await this.usersService.save(u);
  }
}

@Cron('0 9 * * *')  // 09:00 daily
async warnGraceEnding() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const users = await this.userRepo.find({
    where: { gracePeriodEnd: Between(now, tomorrow) },
  });
  for (const u of users) {
    await this.notify.send(u.id, 'Pro доступ истекает завтра');
  }
}

@Cron('0 9 * * *')  // 09:00 daily
async cleanupAbandonedWorkspaces() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const workspaces = await this.workspaceRepo.find({
    where: { expiredAt: LessThan(cutoff) },
  });
  for (const w of workspaces) {
    // Soft delete: set deletedAt, don't actually drop data
    w.deletedAt = new Date();
    await this.workspaceRepo.save(w);
  }
}
```

### 6. RC INITIAL_PURCHASE / RENEWAL — clear grace

При RC INITIAL_PURCHASE / RENEWAL / UNCANCELLATION:
```typescript
user.gracePeriodEnd = null;
user.gracePeriodReason = null;
```

И если это team plan — также убрать `Workspace.expiredAt = null`.

### 7. getBillingInfo response — новые поля

```typescript
return {
  plan: effective.plan,
  source: effective.source,                // NEW
  isTeamOwner: effective.isTeamOwner,      // NEW
  isTeamMember: effective.isTeamMember,    // NEW
  hasOwnPro: effective.hasOwnPro,          // NEW
  graceUntil: effective.graceUntil?.toISOString() ?? null,  // NEW
  graceDaysLeft: effective.graceDaysLeft ?? null,           // NEW
  workspaceExpiringAt: effective.workspaceExpiringAt?.toISOString() ?? null,  // NEW
  // ...existing fields
};
```

---

## Mobile: UI degradation после grace

### 1. Subscriptions list (`app/(tabs)/subscriptions.tsx`)

Когда `effectivePlan === 'free' && subscriptions.length > 3`:
- Sort by `createdAt asc`
- First 3 — render normally
- 4-th+ — render `<LockedSubscriptionCard subscription={...} />`:
  - Серый фон `colors.surface2`
  - Замок Ionicons `lock-closed` справа
  - Имя: blur effect или `••••••••`
  - Цена: `opacity: 0.3` + blur (через `react-native-skia` НЕТ — просто opacity)
  - onPress → `Alert.alert(t('team_logic.locked_sub_alert_title'), t('team_logic.locked_sub_alert_msg', { count: hiddenCount }), [{ text: 'Get Pro', onPress: () => router.push('/paywall') }, { text: t('common.cancel') }])`
- Banner вверху списка:
  - "Скрыто {{count}} подписок · Включи Pro" with CTA chevron
  - onPress → `/paywall`

**Новый компонент:** `src/components/LockedSubscriptionCard.tsx`

### 2. Dashboard (`app/(tabs)/index.tsx`)

```typescript
const visibleSubs = effectivePlan === 'free' && subscriptions.length > 3
  ? subscriptions.slice(0, 3)
  : subscriptions;
const hiddenCount = subscriptions.length - visibleSubs.length;
```

- `totalMonthly` считается **только из visibleSubs** (это и есть "урезание" — цифра становится меньше)
- Под hero card — текст "{{count}} subs hidden after plan expired" если hiddenCount > 0
- Top banner: "Восстанови доступ к {{count}} подпискам — Включи Pro"

### 3. Analytics (`app/(tabs)/analytics.tsx`)

- Графики строятся только из `visibleSubs`
- Под графиком badge: "Без скрытых: USD {{full_amount}}/mo" (показываем что было)

### 4. Settings — новый badge

```typescript
const planBadge = (() => {
  if (graceDaysLeft) return { label: t('settings.plan_grace'), color: '#F59E0B', sub: `${graceDaysLeft}d left` };
  if (isTeamOwner) return { label: t('settings.plan_team'), color: '#06B6D4' };
  if (hasOwnPro && isTeamMember) return { label: t('settings.plan_pro_team'), color: '#06B6D4' };
  if (isTeamMember) return { label: t('settings.plan_team_member'), color: '#06B6D4' };
  if (isPro) return { label: t('settings.plan_pro'), color: '#8B5CF6' };
  if (subscriptions.length > 3) return { label: t('settings.plan_free'), color: '#6B7280', sub: t('team_logic.badge_was_pro') };
  return { label: t('settings.plan_free'), color: '#6B7280' };
})();
```

---

## Mobile: Workspace UX

### Owner view — expired alert

```jsx
{workspaceExpiringAt && (
  <View style={styles.expiredAlert}>
    <Text>{t('team_logic.expired_owner_alert', { days: daysUntilWorkspaceDeleted })}</Text>
    <TouchableOpacity onPress={() => router.push('/paywall')}>
      <Text>{t('team_logic.expired_owner_cta')}</Text>
    </TouchableOpacity>
  </View>
)}
```

### Member view — grace banner

```jsx
{graceDaysLeft && graceReason === 'team_expired' && (
  <View style={styles.graceBanner}>
    <Text>{t('team_logic.grace_member_banner_title')}</Text>
    <Text>{t('team_logic.grace_member_banner_desc', { days: graceDaysLeft })}</Text>
    <TouchableOpacity onPress={() => router.push('/paywall')}>
      <Text>{t('team_logic.grace_member_cta')}</Text>
    </TouchableOpacity>
  </View>
)}
```

### Pro+Team double-pay banner

В `app/(tabs)/index.tsx` сверху + в `settings.tsx`:

```jsx
{hasOwnPro && isTeamMember && !isTeamOwner && (
  <View style={styles.doublePayBanner}>
    <Text>{t('team_logic.double_pay_banner_title')}</Text>
    <Text>{t('team_logic.double_pay_banner_desc')}</Text>
    <TouchableOpacity onPress={() => RevenueCatUI.presentCustomerCenter()}>
      <Text>{t('team_logic.double_pay_cta')}</Text>
    </TouchableOpacity>
  </View>
)}
```

### JoinTeamSheet — warning if has own Pro

В `JoinTeamSheet.tsx` перед `joinByCode`:

```typescript
if (billing?.hasOwnPro) {
  Alert.alert(
    t('team_logic.join_warn_title'),
    t('team_logic.join_warn_desc'),
    [
      { text: t('team_logic.join_warn_cta_cancel_pro'), onPress: () => RevenueCatUI.presentCustomerCenter() },
      { text: t('team_logic.join_warn_cta_continue'), onPress: () => actuallyJoin() },
    ],
  );
} else {
  actuallyJoin();
}
```

### Members list (owner view)

В members render:
```jsx
<Text style={styles.memberStatus}>
  {member.user.hasOwnPro ? t('team_logic.member_status_own_pro') :
   member.user.gracePeriodEnd ? t('team_logic.member_status_grace') :
   t('team_logic.member_status_team')}
</Text>
```

Backend должен возвращать эти поля в members list endpoint.

---

## i18n: новые ключи (10 локалей)

```json
"team_logic": {
  "badge_team_member": "Team Member",
  "badge_pro_team": "Pro + Team",
  "badge_grace": "Grace · {{days}}d left",
  "badge_was_pro": "Was Pro",

  "expired_owner_alert": "Subscription expired. Team will be closed in {{days}} days. Renew?",
  "expired_owner_cta": "Renew Subscription",

  "grace_member_banner_title": "Owner stopped paying",
  "grace_member_banner_desc": "{{days}} days of Pro left. Get your own Pro to keep access.",
  "grace_member_cta": "Get my own Pro — $2.99/mo",

  "grace_pro_banner_title": "Pro expired",
  "grace_pro_banner_desc": "{{days}} days left. Renew Pro or join a Team.",
  "grace_pro_cta": "Renew Pro",

  "double_pay_banner_title": "You have Pro and Team",
  "double_pay_banner_desc": "Cancel your Pro to avoid paying twice.",
  "double_pay_cta": "Cancel my Pro",

  "join_warn_title": "You already have Pro",
  "join_warn_desc": "Joining Team means paying for both. Continue?",
  "join_warn_cta_continue": "Join and pay both",
  "join_warn_cta_cancel_pro": "Cancel Pro first",

  "locked_subs_banner": "{{count}} subscriptions hidden — Get Pro to see all",
  "locked_sub_alert_title": "Subscription locked",
  "locked_sub_alert_msg": "Get Pro to see {{count}} hidden subscriptions",
  "hero_locked_hint": "{{count}} subs hidden after plan expired",
  "analytics_locked_hint": "Without hidden: {{amount}}/mo",

  "member_status_own_pro": "Has own Pro",
  "member_status_team": "Team member",
  "member_status_grace": "Grace ending soon"
},
"settings": {
  "plan_team_member": "TEAM MEMBER",
  "plan_pro_team": "PRO + TEAM",
  "plan_grace": "GRACE"
}
```

---

## Analytics events

```typescript
'grace_started' { reason, source }
'grace_ending_warning_shown'
'grace_ended_downgraded'
'grace_recovered_pro_purchased'
'locked_sub_tapped' { hidden_count }
'locked_banner_tapped'
'double_pay_banner_shown'
'double_pay_cancel_tapped'
'join_warn_shown'
'join_warn_continued'
'team_owner_expired_renewed'
'team_owner_expired_abandoned'
```

Add to `AnalyticsEvent` union in `src/services/analytics.ts`.

---

## Файлы для изменения

### Backend (subradar-backend)

**Создать:**
- `src/billing/grace-period.cron.ts`
- `src/migrations/[ts]_add_grace_period_to_users.ts`
- `src/migrations/[ts]_add_expired_at_to_workspace.ts`

**Модифицировать:**
- `src/users/entities/user.entity.ts` — add gracePeriodEnd, gracePeriodReason
- `src/workspace/entities/workspace.entity.ts` — add expiredAt
- `src/users/users.service.ts` — add to ALLOWED_KEYS
- `src/billing/billing.service.ts` — getEffectiveAccess, handleTeamOwnerExpiration, modify EXPIRATION/INITIAL_PURCHASE/RENEWAL/UNCANCELLATION webhooks, modify cancelSubscription, modify getBillingInfo to return new fields
- `src/workspace/workspace.service.ts` — modify leaveTeam to set grace
- `src/subscriptions/guards/subscription-limit.guard.ts` — use getEffectiveAccess
- `src/analysis/guards/plan.guard.ts` — use getEffectiveAccess
- `src/billing/billing.module.ts` — register grace-period cron
- `src/workspace/workspace.controller.ts` — return member statuses (hasOwnPro, gracePeriodEnd) in members list

### Mobile (subradar-mobile)

**Создать:**
- `src/components/LockedSubscriptionCard.tsx`
- `src/components/GraceBanner.tsx`
- `src/components/DoublePayBanner.tsx`

**Модифицировать:**
- `src/types/index.ts` — add new BillingStatus fields (source, isTeamOwner, etc.)
- `src/hooks/useEffectiveAccess.ts` (NEW HOOK) — wraps useBillingStatus + computes UI flags
- `app/(tabs)/index.tsx` — visibleSubs slicing, hero hint, double-pay banner
- `app/(tabs)/subscriptions.tsx` — locked cards rendering + hidden count banner
- `app/(tabs)/analytics.tsx` — visibleSubs in calculations + locked hint
- `app/(tabs)/settings.tsx` — new plan badge logic + double-pay banner
- `app/(tabs)/workspace.tsx` — owner expired alert + member grace banner + members status
- `src/components/JoinTeamSheet.tsx` — warning if has own Pro
- `src/locales/*.json` (10) — new translation keys
- `src/services/analytics.ts` — new event names

**Не трогать:**
- Payment flow (purchasePackage, RC integration)
- App Store Connect config
- Onboarding
