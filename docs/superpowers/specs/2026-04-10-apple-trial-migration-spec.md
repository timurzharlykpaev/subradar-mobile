# Миграция триала: Backend → Apple/RevenueCat

**Goal:** Триал через App Store с автоматическим списанием после 7 дней. Юзер привязывает карту при старте триала, Apple автоматически продлевает если не отменил.

**Текущее состояние:** Бэкенд-триал. `POST /billing/trial` → plan: pro на 7 дней → cron даунгрейдит. Деньги не списываются. Нет привязки к App Store.

**Целевое состояние:** Apple Introductory Offer (7-day free trial) на продуктах Pro Monthly/Yearly. Старт через RevenueCat `purchasePackage`. Apple управляет подпиской, автосписание, отмена через iOS Settings.

---

## Что нужно сделать вне кода (App Store Connect + RevenueCat)

### App Store Connect
1. Зайти в **App Store Connect → Subscriptions → io.subradar.mobile.pro.monthly**
2. В секции **Introductory Offers** → Add Introductory Offer:
   - Type: **Free Trial**
   - Duration: **7 days**
   - Повторить для `io.subradar.mobile.pro.yearly`
3. Опционально для Team: `io.subradar.mobile.team.monthly`, `team.yearly`

### RevenueCat Dashboard
1. Зайти в **RevenueCat → Project → Offerings → Current**
2. Убедиться что продукты `pro.monthly` и `pro.yearly` привязаны к packages
3. RevenueCat автоматически подтянет trial eligibility из App Store Connect
4. В Products → проверить что `introductoryDiscount` видно

---

## Изменения в коде

### 1. Mobile — TrialOfferModal → Paywall вместо backend API

**Файл:** `app/(tabs)/index.tsx`

**Было:** `onStartTrial` → `POST /billing/trial` → бэкенд ставит plan:pro
**Стало:** `onStartTrial` → закрыть модалку → `router.push('/paywall')` → юзер покупает через App Store (с trial offer)

```tsx
onStartTrial={() => {
  setShowTrialOffer(false);
  router.push('/paywall');
}}
```

### 2. Mobile — Paywall показывает trial offer из RevenueCat

**Файл:** `app/paywall.tsx`

**Было:** `canTrial` определяется из `billing.trialUsed` (бэкенд поле)
**Стало:** `canTrial` определяется из RevenueCat `introEligibility`

- При загрузке offerings проверяем `package.product.introductoryDiscount`
- Если есть → показываем "7 дней бесплатно, потом $X.XX/мес"
- CTA кнопка: "Начать бесплатный триал"
- При нажатии → `purchasePackage(pkg)` — Apple показывает confirmation sheet с "7 days free, then $2.99/month"
- Apple привязывает карту, юзер подтверждает Face ID

### 3. Mobile — useRevenueCat: проверка trial eligibility

**Файл:** `src/hooks/useRevenueCat.ts`

Добавить в `loadOfferings`:
```ts
// Check trial eligibility for each package
const checkEligibility = await Purchases.checkTrialOrIntroDiscountEligibility(
  offerings.current?.availablePackages?.map(p => p.product.identifier) ?? []
);
```

Вернуть `trialEligible` из хука.

### 4. Backend — Убрать бэкенд-триал

**Файл:** `billing.service.ts`

- `startTrial()` — оставить но пометить deprecated (для обратной совместимости со старыми клиентами)
- `getBillingInfo()` — триал-статус определять из RC данных (cancelAtPeriodEnd + currentPeriodEnd), не из trialEndDate
- RC INITIAL_PURCHASE webhook с trial = true → бэкенд ставит plan: pro, billingSource: revenuecat

### 5. Backend — getBillingInfo адаптация

**Файл:** `billing.service.ts`

Триал через RC = обычная RC-подписка с `trial_start` в entitlements. Бэкенд не различает trial от paid — оба приходят как INITIAL_PURCHASE. `status: 'trialing'` определяется по полю в RC webhook.

RC webhook `INITIAL_PURCHASE` содержит `is_trial_period: true` → можно сохранить в user поле для отображения.

### 6. Mobile — Убрать `trialUsed` логику из фронта

**Файлы:** `paywall.tsx`, `index.tsx`, `settings.tsx`, `subscription-plan.tsx`

- Удалить все проверки `billing?.trialUsed`
- Trial eligibility определяется только из RC (Apple знает использовал ли юзер trial)
- Apple гарантирует один trial на Apple ID — невозможно использовать дважды

---

## Флоу после миграции

```
Регистрация → Free (plan: free, trialUsed: false)
↓
Добавил подписку → TrialOfferModal
↓
"Попробовать Pro бесплатно" → router.push('/paywall')
↓
Paywall: "7 дней бесплатно, потом $2.99/мес"
↓
Нажимает CTA → Apple Confirmation Sheet
"Confirm subscription: 7-day free trial, then $2.99/mo"
↓
Face ID → Apple привязывает карту
↓
RC webhook INITIAL_PURCHASE → backend: plan=pro, billingSource=revenuecat
↓
7 дней → Apple автоматически списывает $2.99
RC webhook RENEWAL → backend: plan stays pro
↓
Если отменил до 7 дней → RC CANCELLATION → RC EXPIRATION → plan=free
```

---

## Что НЕ меняется
- Paywall UI (план-карточки, toggle monthly/yearly, features)
- Цены (управляются в App Store Connect)
- Backend RC webhook handler (уже обрабатывает INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION)
- Cancel через Settings → RevenueCat Customer Center (уже работает для RC подписок)
