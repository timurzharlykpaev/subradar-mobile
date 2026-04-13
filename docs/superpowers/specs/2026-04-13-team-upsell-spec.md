# Team Plan Upsell — Spec

**Goal:** Повысить конверсию Pro → Team через дизайн и UX (без изменения логики/цен/payment flow). Гибрид: persistent inline-карточки с персональным расчётом + ОДИН раз полноэкранный модал в момент истины.

**Audience:** Pro users (семьи и dev-команды). Apple-managed subscriptions через RevenueCat — никакой логики оплаты не меняем.

**Constraints:**
- Не ломать payment flow (всё через RC + paywall)
- Не менять цены (управляются App Store Connect)
- Не менять навигацию или layout экранов
- Все тексты через i18n (10 локалей)
- Респектовать "may be later" — не спамить
- Только Pro → Team upsell (Free → Pro flow не трогать)

---

## 1. Inline-карточки — три точки касания

### 1.1 Dashboard — Team Savings Calculator
**Файл:** `app/(tabs)/index.tsx`
**Где:** Заменить/расширить существующую `TeamSavingsBadge`
**Условие показа:** `isPro && !isTeam && totalMonthly >= 20`

**UI:**
- Иконка `people` (cyan #06B6D4) + заголовок: t('team_upsell.dashboard_title', 'Раздели и сэкономь')
- Расчёт: `totalMonthly` → `totalMonthly / 4` per person
- "Экономия {{amount}}/год" — `(totalMonthly * 12 * 0.75)` rounded
- Маленькая CTA chevron-right
- onPress: analytics `team_upsell_dashboard_card_tapped` → `router.push('/paywall')`

### 1.2 Analytics — Spent vs Could Spend
**Файл:** `app/(tabs)/analytics.tsx`
**Где:** Под графиком расходов (после "Расходы по месяцам")
**Условие показа:** `isPro && !isTeam && totalMonthly >= 20`

**UI:**
- Карточка с двумя цифрами рядом:
  - "Сейчас USD {{amount}}/мес"
  - "С Team USD {{amount/4}}/мес на каждого"
- "Сэкономили бы USD {{yearly_savings}}/год"
- CTA: "Создать команду →"

### 1.3 Subscriptions — Duplicate Categories Banner
**Файл:** `app/(tabs)/subscriptions.tsx`
**Где:** Над списком подписок
**Условие показа:** `isPro && !isTeam && duplicateCategoriesCount >= 1`

**UI:**
- Баннер: t('team_upsell.dupe_banner', 'Найдено {{count}} подписок на {{category}}. Включи Team чтобы видеть кто платит')
- Иконка `warning` оранжевая
- CTA: "Включить Team →"

---

## 2. Полноэкранный Team Savings Modal

**Файл:** Новый компонент `src/components/TeamUpsellModal.tsx`
**Триггер:** Один раз за всю историю юзера (флаг `team_modal_shown_v1`), при выполнении ЛЮБОГО:
- `activeSubs.length >= 8`
- `duplicateCategories.length >= 2`
- `totalMonthly >= 50`
- Workspace tab открыт 2+ раза (счётчик в AsyncStorage)

**Исключения:**
- `isTeam === true` (уже Team)
- `team_modal_shown_v1 === '1'` в AsyncStorage
- `!isPro` (только Pro юзеров)

**Где интегрировать:** В `app/_layout.tsx` или `app/(tabs)/_layout.tsx` — глобально, чтобы триггерился из любого таба.

**UI структура:**

```
┌─────────────────────────────────────┐
│  ✕ (close, top-right)               │
│                                     │
│        [Family icon with glow]     │
│                                     │
│   "Платишь за всех? Раздели."     │
│                                     │
│   ┌─────────────────────────────┐  │
│   │ USD 50/мес                   │  │
│   │ ↓ делится на 4              │  │
│   │ USD 12.50 каждому            │  │
│   │ = USD 450/год экономии       │  │
│   └─────────────────────────────┘  │
│                                     │
│   [👨‍👩‍👧 Семья на одной странице]   │
│   [🔍 Без дублей подписок]         │
│   [🤖 1000 AI запросов]            │
│                                     │
│   "$9.99/мес — меньше одной       │
│    подписки"                        │
│                                     │
│   ╔═════════════════════════════╗  │
│   ║ Создать команду — $9.99/мес ║  │
│   ╚═════════════════════════════╝  │
│         "Может позже"               │
│                                     │
│   "Можно отменить в любой момент"  │
└─────────────────────────────────────┘
```

**Анимации:**
- Backdrop fade (200ms)
- Card slide up + fade (300ms)
- Cifra USD count-up (1500ms)
- Benefits stagger fade-in (200ms delay each)

**Действия:**
- Primary CTA → analytics `team_upsell_modal_cta_tapped` → `router.push('/paywall')`
- Secondary "Может позже" → set `team_modal_shown_v1` = '1', сохранить timestamp в `team_modal_dismissed_at`
- Close (X) → то же что secondary

---

## 3. Усиление существующих точек

### 3.1 Workspace tab — personal hero перед feature list
**Файл:** `app/(tabs)/workspace.tsx`
**Где:** Над текущим feature list (line ~140)

**UI добавить:**
- "Ты тратишь USD {{totalMonthly}}/мес на подписки"
- "С Team разделил бы на USD {{totalMonthly/4}}"

### 3.2 Paywall — "Save vs separate" badge на Team карточке
**Файл:** `app/paywall.tsx`
**Где:** В `PLANS` array у `org` plan вместо/дополнительно к features

**UI:**
- Бейдж "Save USD {{amount}}/year" (вместо или рядом с обычным badge)
- Расчёт: `(totalMonthly * 12 * 0.75)` если `totalMonthly` > 0, иначе fallback "$XX/year"

### 3.3 Dashboard баннер — динамический текст
**Файл:** `app/(tabs)/index.tsx` (существующий "Share with family?" баннер, line ~293)

**Изменить текст:**
- Было: t('dashboard.team_upsell_desc', 'Team plan: split costs & spot duplicate subs')
- Стало: t('team_upsell.dashboard_dynamic', 'Делишь с 4 людьми? Сэкономь {{amount}}/год')

### 3.4 Subscription detail — "Кто-то ещё платит?" hint
**Файл:** `app/subscription/[id].tsx`
**Где:** Под основной информацией подписки

**UI (только если `isPro && !isTeam`):**
- Маленький блок: "Есть другие в семье с {{subscription.name}}? Включи Team чтобы найти дубли"
- Линк-стиль кнопка: "Узнать больше →"

### 3.5 AI limit reached — Team CTA в Alert
**Файл:** `src/components/AddSubscriptionSheet.tsx` (или wherever AI limit Alert)

**Изменить Alert** при upgrade prompt:
- Сейчас: 1 кнопка "Upgrade to Pro"
- Стало для Pro юзера: "Перейти на Team — 1000 AI запросов" (primary) + "Подождать до следующего месяца" (cancel)

---

## 4. Локализация + Analytics

### 4.1 Новые i18n ключи (10 локалей)

```json
"team_upsell": {
  "modal_title": "Платишь за всех? Раздели.",
  "modal_subtitle": "Сэкономь до 75% — раздели подписки с командой или семьёй",
  "current_spend_label": "Ты тратишь",
  "split_label": "Делится на 4 человек",
  "per_person_label": "На каждого",
  "yearly_savings": "{{amount}}/год экономии",
  "benefit_family_title": "Семья на одной странице",
  "benefit_family_desc": "Все подписки видны всей команде",
  "benefit_no_dupes_title": "Без дублей подписок",
  "benefit_no_dupes_desc": "Найди когда кто-то уже платит за Netflix",
  "benefit_ai_title": "1000 AI запросов",
  "benefit_ai_desc": "В 5 раз больше чем на Pro",
  "price_hint": "$9.99/мес — меньше одной подписки",
  "cta_create_team": "Создать команду — $9.99/мес",
  "cta_later": "Может позже",
  "disclaimer": "Можно отменить в любой момент",
  "dashboard_title": "Раздели и сэкономь",
  "dashboard_dynamic": "Делишь с 4 людьми? Сэкономь {{amount}}/год",
  "analytics_title": "Сэкономь с Team",
  "analytics_current": "Сейчас {{amount}}/мес",
  "analytics_with_team": "С Team {{amount}}/мес на каждого",
  "analytics_yearly": "Экономия {{amount}}/год",
  "dupe_banner": "Найдено {{count}} подписок на {{category}}. Включи Team",
  "detail_hint": "Есть другие в семье с {{name}}? Найди дубли",
  "ai_limit_team_cta": "Перейти на Team — 1000 AI запросов",
  "ai_limit_wait": "Подождать до следующего месяца",
  "workspace_hero": "Ты тратишь {{amount}}/мес на подписки",
  "workspace_split": "С Team разделил бы на {{amount}}"
},
"paywall": {
  "save_vs_separate": "Экономия {{amount}}/год"
}
```

### 4.2 Analytics events

```typescript
analytics.track('team_upsell_modal_shown', { trigger: 'subs_count' | 'duplicates' | 'spend' | 'workspace_visits' })
analytics.track('team_upsell_modal_dismissed')
analytics.track('team_upsell_modal_cta_tapped')
analytics.track('team_upsell_dashboard_card_tapped')
analytics.track('team_upsell_analytics_card_tapped')
analytics.track('team_upsell_dupe_banner_tapped')
analytics.track('team_upsell_detail_hint_tapped')
analytics.track('team_upsell_ai_limit_tapped')
```

### 4.3 AsyncStorage флаги

```typescript
'team_modal_shown_v1' // '1' | null — модал показан
'team_modal_dismissed_at' // ISO timestamp — для повторного показа через 30 дней
'workspace_visits_count' // number — счётчик визитов workspace tab
```

---

## Файлы для изменения

**Создать:**
- `src/components/TeamUpsellModal.tsx`

**Модифицировать:**
- `app/(tabs)/index.tsx` — Dashboard card + dynamic banner text + modal trigger
- `app/(tabs)/analytics.tsx` — Analytics card
- `app/(tabs)/subscriptions.tsx` — Duplicate banner
- `app/(tabs)/workspace.tsx` — Personal hero + visit counter
- `app/(tabs)/_layout.tsx` или `app/_layout.tsx` — Modal global mounting + trigger logic
- `app/paywall.tsx` — Team save badge
- `app/subscription/[id].tsx` — Detail hint
- `src/components/AddSubscriptionSheet.tsx` — AI limit Alert with Team CTA
- `src/locales/*.json` (10 files) — переводы

**Не трогать:**
- `app/onboarding.tsx`
- `src/hooks/useRevenueCat.ts`
- `src/hooks/useBilling.ts`
- Backend код (никаких изменений)
