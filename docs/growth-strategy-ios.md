# Bratar — iOS Growth Strategy & Monetization Playbook

> **Статус:** Живой документ. Обновляется по мере тестирования гипотез.
> **Фокус:** iOS → профитабельность → масштаб
> **Целевой горизонт:** 90 дней до положительного unit economics

---

## SECTION 1 — PRODUCT & ICP

### 1.1 Кто наш идеальный пользователь

#### ICP #1 — «Утопающий в подписках» (25–34, iOS, $60K+ доход)
- **Финансовая боль:** платит за Netflix, Spotify, ChatGPT, Notion, Figma, Adobe, Duolingo, Calm, Apple iCloud, Google One + ещё 5–7 забытых сервисов. Реальный spend: $180–240/мес, ощущаемый — «ну долларов 60».
- **Эмоциональный триггер:** шок при проверке выписки банковской карты. «Когда я это вообще подключил?»
- **Точка входа в AppStore:** запрос «subscription tracker» после внезапного списания.

#### ICP #2 — «Охотник за фри-триалами» (22–30, tech-savvy)
- **Финансовая боль:** намеренно подписывается на триалы и забывает отменить. Теряет $40–80/мес.
- **Эмоциональный триггер:** злость на себя. «Опять забыл. Это уже третий раз.»
- **Точка входа:** TikTok / Reddit — «how to track free trials».

#### ICP #3 — «Фрилансер / соло-предприниматель» (28–40)
- **Финансовая боль:** бизнес-подписки смешаны с личными. Не понимает реальную себестоимость бизнеса.
- **Эмоциональный триггер:** «Мой бухгалтер спросил про подписки — я не знал ответа».
- **Точка входа:** Apple Search Ads по запросам «expense tracker» + «subscription manager».

#### ICP #4 — «Семейный финансист» (30–45, семья 3–4 человека)
- **Финансовая боль:** несколько членов семьи, каждый со своими подписками. Перекрытия (3 Netflix), забытые детские сервисы.
- **Эмоциональный триггер:** «Мы платим за одно и то же трижды».
- **Точка входа:** уговаривает перейти на Team план.

#### ICP #5 — «Параноик по privacy» (любой возраст, iOS-лоялист)
- **Финансовая боль:** боится тёмных паттернов сервисов — автоматический апгрейд, скрытые тарифы.
- **Эмоциональный триггер:** «Хочу контролировать, кому и сколько плачу».
- **Точка входа:** App Store поиск, органика.

### 1.2 Общий эмоциональный архетип

> **Не «я хочу организованность»**
> **А «я устал терять деньги на вещи, которыми не пользуюсь»**

Это стыд + злость на себя + желание контроля. Маркетинг должен попадать именно в это.

---

## SECTION 2 — UNIT ECONOMICS

### 2.1 Входные параметры

| Метрика | Значение |
|---------|----------|
| CPI Apple Search Ads | $1.50 – $4.00 |
| Install → Trial start | 15–25% |
| Trial → Paid | 25–40% |
| Monthly Pro | $2.99 |
| Yearly Pro | $27.00 (~$2.25/мес) |
| Monthly Team | $9.99 |
| Yearly Team | $77.00 (~$6.42/мес) |
| App Store fee | 30% (15% для <$1M) |

### 2.2 Расчёт конверсии install → paid

```
Effective conversion = Install→Trial × Trial→Paid

Pessimistic:  15% × 25% = 3.75%
Realistic:    20% × 33% = 6.6%
Optimized:    25% × 40% = 10.0%
```

### 2.3 CAC расчёт

```
CAC = CPI / conversion_rate

Pessimistic:  $3.50 / 3.75% = $93.3
Realistic:    $2.50 / 6.6%  = $37.9
Optimized:    $2.00 / 10.0% = $20.0
```

### 2.4 LTV расчёт (после App Store fee 15%)

**LTV по планам (нетто):**
```
Monthly Pro:    $2.99 × 0.85 = $2.54/мес
Yearly Pro:     $27.00 × 0.85 = $22.95/год → $1.91/мес
Monthly Team:   $9.99 × 0.85 = $8.49/мес
Yearly Team:    $77.00 × 0.85 = $65.45/год → $5.45/мес
```

**12-месячный LTV (с учётом churn):**

*Допущения: monthly churn 8%, annual churn 20%*

| Plan | 12M LTV (нетто) |
|------|----------------|
| Monthly Pro | $2.54 × (1–0.08)^12 avg ≈ **$19.8** |
| Yearly Pro | $22.95 × (1–0.20) = **$18.4** (год 1) → $36.8 (год 2) |
| Monthly Team | $8.49 × avg ≈ **$66** |
| Yearly Team | $65.45 × (1–0.20) = **$52.4** (год 1) |

**Blended LTV** (микс: 50% monthly pro, 35% yearly pro, 10% monthly team, 5% yearly team):
```
Blended 12M LTV = 0.5×$19.8 + 0.35×$18.4 + 0.1×$66 + 0.05×$52.4
                = $9.9 + $6.44 + $6.6 + $2.62
                = ~$25.56
```

### 2.5 Три сценария

| | Pessimistic | Realistic | Optimized |
|-|-------------|-----------|-----------|
| CPI | $3.50 | $2.50 | $2.00 |
| Conv rate | 3.75% | 6.6% | 10% |
| CAC | $93.3 | $37.9 | $20.0 |
| Blended LTV | $18 | $25.5 | $35 |
| LTV/CAC | 0.19x ❌ | 0.67x ⚠️ | 1.75x ✅ |
| Payback period | Never | 18 мес | 7 мес |

### 2.6 Break-even CAC

```
Break-even CAC = Blended LTV × target_margin

При margin 50%: break-even CAC = $25.56 × 0.5 = $12.8
При margin 30%: break-even CAC = $25.56 × 0.7 = $17.9
```

**Вывод:** текущая unit economics убыточна при paid acquisition. Для выхода в профит нужно:
1. Conversion rate → 10%+ (онбординг + пейволл работа)
2. Сдвиг микса к annual планам (LTV x1.5)
3. Снизить CPI через ASO + органику до $1.5 (blended CPI с органикой)
4. Увеличить LTV через снижение churn и upsell в Team

**Реалистичный путь к профиту:**
```
С учётом 40% органики (CPI=$0):
Blended CPI = 0.6 × $2.50 + 0.4 × $0 = $1.50
CAC = $1.50 / 8% = $18.75
LTV (с упором на annual) = $30+
LTV/CAC = 1.6x ✅
Payback = 6–8 мес
```

---

## SECTION 3 — iOS GROWTH STRATEGY

### 3.1 Почему iOS-first

| Фактор | iOS | Android |
|--------|-----|---------|
| ARPU | 2–3x выше | ниже |
| Conversion rate к IAP | ~2x выше | ниже |
| CPI (Search Ads) | управляемый | конкурентнее |
| App Store качество фильтрации | выше | больше фрода |
| Аудитория subscription apps | iOS-dominant | |

**iOS пользователи тратят в 2–4x больше денег на приложения.** Для subscription tracker — прямая корреляция: если человек платит за приложение, значит он в принципе платит за подписки.

### 3.2 Почему Android отложен

- Fragmentация устройств = дополнительные тесты/баги
- Google Play IAP конверсия значительно ниже
- RevenueCat инфраструктура уже настроена под iOS
- Ресурсы ограничены — фокус на прибыльном сегменте

### 3.3 Каналы (приоритет)

#### 1. Apple Search Ads (PRIMARY — 60% бюджета)

**Почему:** намеренный поиск = highest intent. Пользователь УЖЕ хочет решение.

```
Целевые кампании:
├── Brand: "bratar", "subradar"
├── Category: "subscription tracker", "subscription manager"  
├── Problem: "track subscriptions", "cancel subscriptions"
├── Adjacent: "budget tracker", "expense tracker", "money manager"
└── Competitor conquest: [competitor names]

Структура:
- Search Match (автоматический) → первая неделя
- Exact Match на топ-конвертеры → масштаб
- Discovery campaigns → новые кейворды
```

**KPIs:** CPT < $0.80, CPA < $25, TTR > 3.5%

#### 2. ASO (органика — 0 бюджета, x2 импакт)

Оптимизация метаданных + визуалов → бесплатные установки. При хорошем ASO 40–60% installs органические.

#### 3. TikTok Organic

Нулевой бюджет, высокий потенциал. Формат: «проверка подписок в реальном времени». Viral loop: пользователи делятся своими результатами.

#### 4. Meta Retargeting (фаза 2 — после достижения 5000 пользователей)

Ретаргет триалистов, не конвертировавшихся. Custom audience: «открыл paywall, не купил».

---

## SECTION 4 — ASO + APP STORE

### 4.1 Три угла позиционирования

#### Угол 1: «Stop Losing Money» (ДЕНЬГИ)
> Ты платишь за подписки, которыми не пользуешься. Прямо сейчас.

- Главный крючок: финансовые потери
- Аудитория: все ICP
- Конверсия: самая высокая (fear + loss aversion)

#### Угол 2: «Track Free Trials» (КОНТРОЛЬ)
> Никогда больше не плати после окончания триала.

- Главный крючок: конкретная боль, очень частая
- Аудитория: ICP #2 (охотники за триалами)
- Конверсия: высокая, очень targeted

#### Угол 3: «Your Money. Your Control.» (ЯСНОСТЬ)
> Полная картина всех твоих подписок в одном месте.

- Главный крючок: clarity и organised life
- Аудитория: ICP #3, #4 (фрилансеры, семьи)
- Конверсия: средняя, хорошая retention

### 4.2 App Store Metadata

**App Title (30 chars max):**
```
Bratar - Subscription Tracker
```

**Subtitle (30 chars max):**
```
Stop Paying for What You Don't Use
```
*Альтернативы:*
- `Track Bills, Cancel Anytime`
- `AI-Powered Expense Manager`

**Promotional Text (170 chars):**
```
Stop wasting money on forgotten subscriptions. Bratar finds them all, tracks renewals, and alerts you before you're charged. Join 10,000+ users saving $50+/mo.
```

### 4.3 Keywords (30 штук)

```
subscription tracker
subscription manager
cancel subscriptions
track subscriptions
bill tracker
recurring expenses
subscription reminder
free trial tracker
monthly bills
subscription organizer
manage subscriptions
automatic renewal
spending tracker
budget tracker
subscription alert
Netflix tracker
subscription list
expense manager
bill reminder
subscription monitor
recurring bills
app subscriptions
subscription overview
money tracker
spending monitor
subscription control
cancel unwanted subscriptions
subscription audit
financial tracker
bill manager
```

### 4.4 Screenshot Copy Strategy

**Screenshot 1 (First impression — HOOK):**
```
Headline: "You're paying $247/month in subscriptions"
Sub:      "And you're using only half of them"
Visual:   Dashboard с реальными цифрами трат
```

**Screenshot 2 (Pain point):**
```
Headline: "3 subscriptions renewing this week"
Sub:      "Netflix · Figma · Adobe — $48.97 total"
Visual:   Upcoming payments с датами
```

**Screenshot 3 (AI feature):**
```
Headline: "Add with your voice in 5 seconds"
Sub:      "Just say 'Spotify $9.99 monthly'"
Visual:   Voice recorder + результат
```

**Screenshot 4 (Analytics):**
```
Headline: "You spent $2,847 on subscriptions this year"
Sub:      "See exactly where your money went"
Visual:   Красивая аналитика по категориям
```

**Screenshot 5 (CTA):**
```
Headline: "Take back control of your money"
Sub:      "Free trial. No credit card required."
Visual:   Paywall с триал CTA
```

### 4.5 Custom Product Pages (CPP)

**CPP #1: «Trial Hunters» (для поиска «free trial tracker»)**
- Screenshots: фокус на триал-трекинге
- Title: "Never Pay After Free Trials End"
- Subtitle: "Track All Your Trials Automatically"

**CPP #2: «Budget-Conscious» (для поиска «budget tracker», «expense tracker»)**
- Screenshots: аналитика трат, monthly spending
- Title: "See All Your Subscription Costs"
- Subtitle: "Smart Budget Tracking & Alerts"

**CPP #3: «Apple Ads Retargeting» (люди, видевшие рекламу)**
- Screenshots: акцент на конкретных деньгах
- Title: "Stop Losing $50+ Monthly"
- Subtitle: "The Subscription Tracker That Pays For Itself"

---

## SECTION 5 — ANALYTICS SYSTEM

### 5.1 События (полный список)

```typescript
// src/services/analytics.ts

export type AnalyticsEvent =
  // Acquisition
  | 'app_open'
  | 'session_start'

  // Onboarding funnel
  | 'onboarding_started'
  | 'onboarding_step_viewed'       // { step: number, step_name: string }
  | 'onboarding_step_completed'    // { step: number }
  | 'onboarding_skipped'           // { step: number }
  | 'onboarding_completed'
  | 'auth_method_selected'         // { method: 'google' | 'apple' | 'email' }
  | 'auth_completed'               // { method: string, is_new_user: boolean }

  // Core activation
  | 'subscription_add_started'     // { source: 'manual' | 'voice' | 'screenshot' | 'ai_lookup' }
  | 'subscription_added'           // { category: string, amount: number, currency: string, billing_cycle: string }
  | 'subscription_first_added'     // первая подписка — критично!
  | 'subscription_deleted'
  | 'subscription_edited'

  // AI features
  | 'ai_voice_started'
  | 'ai_voice_completed'           // { success: boolean }
  | 'ai_screenshot_started'
  | 'ai_screenshot_completed'      // { success: boolean, confidence: number }
  | 'ai_lookup_used'               // { query: string }

  // Monetization funnel
  | 'paywall_viewed'               // { source: 'onboarding' | 'feature_gate' | 'settings' | 'direct' }
  | 'paywall_plan_selected'        // { plan: 'pro' | 'org', period: 'monthly' | 'yearly' }
  | 'paywall_period_toggled'       // { to: 'monthly' | 'yearly' }
  | 'trial_cta_tapped'
  | 'trial_started'                // { plan: string }
  | 'purchase_initiated'           // { plan: string, period: string, price: number }
  | 'purchase_completed'           // { plan: string, period: string, price: number, revenue: number }
  | 'purchase_failed'              // { error: string }
  | 'purchase_cancelled'
  | 'paywall_dismissed'            // { after_seconds: number, furthest_plan_seen: string }
  | 'restore_tapped'
  | 'restore_completed'

  // Retention
  | 'notification_permission_granted'
  | 'notification_permission_denied'
  | 'push_opened'                  // { type: 'renewal_reminder' | 'weekly_report' | 'trial_expiry' }
  | 'analytics_viewed'
  | 'report_generated'

  // Churn signals
  | 'subscription_cancelled'       // { plan: string, reason?: string }
  | 'cancellation_intercepted'     // cancellation flow shown
  | 'win_back_viewed'
  | 'win_back_resubscribed';
```

### 5.2 Analytics Service (TypeScript)

```typescript
// src/services/analytics.ts

import * as amplitude from '@amplitude/analytics-react-native';
// OR: import analytics from '@segment/analytics-react-native';
// OR: import { FirebaseAnalytics } from '@react-native-firebase/analytics';

interface EventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

class AnalyticsService {
  private userId: string | null = null;
  private sessionId: string = Date.now().toString();

  init(apiKey: string) {
    amplitude.init(apiKey, {
      flushIntervalMillis: 10000,
      flushQueueSize: 30,
      trackingSessionEvents: true,
    });
  }

  identify(userId: string, traits?: Record<string, any>) {
    this.userId = userId;
    amplitude.setUserId(userId);
    if (traits) {
      const identifyEvent = new amplitude.Identify();
      Object.entries(traits).forEach(([key, value]) => {
        identifyEvent.set(key, value);
      });
      amplitude.identify(identifyEvent);
    }
  }

  track(event: AnalyticsEvent, properties?: EventProperties) {
    const enriched = {
      ...properties,
      session_id: this.sessionId,
      timestamp: Date.now(),
    };

    amplitude.track(event, enriched);

    // Debug в dev
    if (__DEV__) {
      console.log(`[Analytics] ${event}`, enriched);
    }
  }

  // Удобные методы для ключевых событий
  paywallViewed(source: string) {
    this.track('paywall_viewed', { source });
  }

  purchaseCompleted(plan: string, period: string, price: number) {
    const revenue = price * 0.85; // после App Store fee
    this.track('purchase_completed', { plan, period, price, revenue });
    // Revenue event для Amplitude
    const revenueEvent = new amplitude.Revenue()
      .setProductId(`io.subradar.mobile.${plan}.${period}`)
      .setPrice(price)
      .setRevenue(revenue);
    amplitude.revenue(revenueEvent);
  }

  subscriptionAdded(category: string, amount: number, currency: string, billingCycle: string, isFirst: boolean) {
    this.track('subscription_added', { category, amount, currency, billing_cycle: billingCycle });
    if (isFirst) {
      this.track('subscription_first_added', { category, amount });
    }
  }

  // Funnels
  trackOnboardingStep(step: number, stepName: string, completed: boolean) {
    this.track(completed ? 'onboarding_step_completed' : 'onboarding_step_viewed', {
      step,
      step_name: stepName,
    });
  }
}

export const analytics = new AnalyticsService();
```

### 5.3 Ключевые воронки для мониторинга

```
Activation funnel:
install → onboarding_started → auth_completed → subscription_first_added

Monetization funnel:
app_open → paywall_viewed → plan_selected → trial_started → purchase_completed

Retention funnel:
subscription_added → push_granted → push_opened → session_start (D7, D14, D30)
```

**Дашборд метрики (приоритет):**
1. D1/D7/D30 retention
2. Install → First subscription added (%)
3. Paywall view → Trial start (%)
4. Trial start → Paid (%)
5. Monthly vs Yearly mix (%)
6. ARPU

---

## SECTION 6 — ONBOARDING (КРИТИЧНО: X2 КОНВЕРСИЯ)

### 6.1 Проблема текущего онбординга

Текущий онбординг показывает фичи (Voice, Camera, Reminders, Analytics). Это **образовательный** подход. Он не конвертирует.

**Что работает:** Заставить пользователя ПОЧУВСТВОВАТЬ боль сразу + дать немедленный aha-moment через действие.

### 6.2 Новый онбординг (7 шагов)

---

#### Шаг 0: Splash (1.5 сек)
```
[Анимация: деньги утекают]
Текст: "Let's find out how much you're really spending"
```
Нет кнопки. Автопереход.

---

#### Шаг 1: HOOK — Money Loss Reveal
```
Заголовок: "The average person wastes $624/year on unused subscriptions"
Подзаголовок: "Want to see how much YOU're losing?"

[Анимация: случайные суммы крутятся — $480, $720, $936, $1,040...]

CTA: "Show me my number →"  [большая кнопка]
Skip: нет (или маленький серый "Later" в углу, без акцента)
```

**Психология:** Loss aversion. Человек боится потерь в 2.5x сильнее, чем хочет приобрести. Персонализация ("your number") увеличивает вовлечённость.

---

#### Шаг 2: ACTIVATION — Добавь первую подписку ПРЯМО СЕЙЧАС
```
Заголовок: "Start by adding one subscription"
Подзаголовок: "Just one. It takes 5 seconds."

[Карточки-примеры для быстрого добавления:]
[ Netflix $15.49 ]  [ Spotify $9.99 ]  [ Apple iCloud $2.99 ]
[ ChatGPT $20 ]     [ Figma $15 ]      [ + Other ]

CTA: "Skip for now" (очень маленький, серый)
```

**Психология:** Commitment & consistency. Добавив одну подписку, пользователь инвестировал в продукт. Он с большей вероятностью продолжит. Это создаёт psychological ownership.

**Почему это даёт x2 конверсию:**
- Пользователи, добавившие хотя бы 1 подписку в первый сеанс, конвертируются в платных в 3–5x чаще
- Aha-moment: видит свой spend → немедленный payoff
- Создаёт данные, которые делают paywall персонализированным

---

#### Шаг 3: INSIGHT — Мгновенный Money Reveal
```
(После добавления подписки)

Заголовок: "You'll spend $X on [ServiceName] this year"
Визуализация: Большая цифра, медленно растущая анимация

Подзаголовок: "Most people have 8–12 more like this"

[Продолжи добавлять]  →  [Не сейчас]
```

---

#### Шаг 4: Auth (если ещё не авторизован)
```
Заголовок: "Save your subscriptions"
Подзаголовок: "Sign in to keep your data safe across devices"

[Continue with Apple]  ← PRIMARY
[Continue with Google]
[Use email →]
```

**Порядок:** Сначала ценность (добавление подписки), потом auth. Пользователь уже вложился → меньше friction при регистрации.

---

#### Шаг 5: Permissions — Push Notifications
```
Заголовок: "Get notified before you're charged"
Подзаголовок: "We'll warn you 3 days before any renewal"

[Пример уведомления mockup:]
┌─────────────────────────────┐
│ 🔔 Bratar                   │
│ Netflix renews in 3 days    │
│ $15.49 will be charged      │
└─────────────────────────────┘

CTA: "Enable Reminders" →   ← вызывает системный диалог
Skip: "Maybe Later" (серый)
```

**Психология:** Показываем конкретную пользу, не просто «разреши уведомления». Consent rate растёт с 30% до 60%+.

---

#### Шаг 6: PAYWALL (сразу после онбординга, если не открыл из feature gate)

Переход прямо на paywall с персонализированным контекстом:
```
"You've added $X/month in subscriptions.
Track unlimited + get renewal alerts → Start free trial"
```

---

### 6.3 Почему это увеличивает конверсию x2

| Механика | Эффект |
|----------|--------|
| Money loss reveal на шаге 1 | Активирует loss aversion — самый мощный психологический триггер |
| Принудительное добавление подписки | Creates ownership + aha-moment в первые 60 секунд |
| Auth ПОСЛЕ ценности | Снижает drop-off при регистрации на 40–60% |
| Конкретный push пример | Увеличивает разрешение на уведомления с 30% до 55%+ |
| Персонализированный paywall | «$X/мес» > «Upgrade to Pro» → конверсия x1.5–2 |

**Benchmark:** Subscription apps с forced-action onboarding конвертируют на уровне 8–12%, против 3–5% у feature-tour онбордингов.

---

## SECTION 7 — PAYWALL (ПОЛНЫЙ РЕДИЗАЙН)

### 7.1 Аудит текущего пейволла

**Проблемы:**
1. ❌ **По умолчанию monthly** — пользователь видит $2.99, а не $27 годовой. Нужно ставить yearly по умолчанию.
2. ❌ **Кнопка закрытия слишком заметна** — `closeBtn` в правом верхнем углу, большая. Пользователь уходит не конвертировавшись.
3. ❌ **Нет страха потери** — копирайт нейтральный («Choose your plan»). Нет эмоционального заряда.
4. ❌ **Free план как дефолтная опция** — это психологически разрешает «остаться бесплатным».
5. ❌ **«Maybe Later»** — прямой escape hatch без retention механики.
6. ❌ **Нет социального доказательства** — ни одной цифры/отзыва.
7. ⚠️ **3 плана одновременно** — cognitive overload. Работает лучше: 2 варианта (annual vs monthly).

### 7.2 Вариант A: «FEAR» (Money Loss)

**Структура:**
```
┌─────────────────────────────────────────┐
│  [X] (маленький, серый, правый угол)    │
│                                          │
│  💸 You're losing $624/year              │
│  on forgotten subscriptions              │
│                                          │
│  Stop it for less than $1/week           │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │  ✅ YEARLY  •  BEST VALUE       │    │  ← DEFAULT
│  │  $27/year  =  $2.25/month       │    │
│  │  Save $8.88 vs monthly          │    │
│  └─────────────────────────────────┘    │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │  Monthly  •  $2.99/month        │    │
│  └─────────────────────────────────┘    │
│                                          │
│  ✓ Unlimited subscriptions              │
│  ✓ Renewal alerts 3 days before         │
│  ✓ AI-powered detection                 │
│  ✓ Full analytics                        │
│                                          │
│  [  START FREE 7-DAY TRIAL  ]           │  ← BIG GREEN
│                                          │
│  ★★★★★ "Saved me $180 in month 1"      │
│                                          │
│  Cancel anytime. No commitment.          │
│  [Restore Purchases]                     │
└─────────────────────────────────────────┘
```

**Психологические триггеры:**
- Loss framing («$624/year losing»)
- Reframing цены («less than $1/week»)
- Default annual — anchoring
- Социальное доказательство (отзыв с $)
- «Cancel anytime» снимает friction

**Ожидаемый uplift:** +40–60% к конверсии vs текущей

---

### 7.3 Вариант B: «CONTROL» (Clarity)

**Структура:**
```
┌─────────────────────────────────────────┐
│                        [Later] (серый)  │
│                                          │
│  🎯 Take control of your subscriptions  │
│                                          │
│  Here's what you'll get:                │
│                                          │
│  📱 Unlimited tracking                  │
│  🔔 Renewal reminders                   │
│  🤖 AI auto-detection                   │
│  📊 Spending analytics                  │
│                                          │
│  ══════════════════════════════         │
│  MOST POPULAR  ▼                        │
│                                          │
│  ●  YEARLY — $27/year                   │  ← pre-selected
│     That's $2.25/month                  │
│     SAVE $8.88/year                     │
│                                          │
│  ○  Monthly — $2.99/month               │
│                                          │
│  [  TRY FREE FOR 7 DAYS  ]              │
│  Then $27/year. Cancel anytime.         │
│                                          │
│  No credit card needed for trial        │
└─────────────────────────────────────────┘
```

**Триггеры:**
- Feature list = value justification
- Pre-selected annual = anchoring
- «No credit card» = zero friction
- «Cancel anytime» = trust

---

### 7.4 Вариант C: «SMART INSIGHTS» (Personalized)

*Используется после того, как пользователь добавил хотя бы одну подписку*

```
┌─────────────────────────────────────────┐
│                        ✕               │
│                                          │
│  📊 Your subscription snapshot          │
│                                          │
│  You spend $47/month on 3 subscriptions │
│  That's $564/year                       │
│                                          │
│  Pro users save avg. $180 in year 1     │
│  by catching forgotten renewals         │
│                                          │
│  ┌───────────────────────────────────┐  │
│  │  🏆 YEARLY  •  Best value         │  │
│  │  $27/year  ($2.25/mo)             │  │
│  │  ████████████████ Save 24%        │  │
│  └───────────────────────────────────┘  │
│                                          │
│  Monthly: $2.99/month                   │
│                                          │
│  [  UNLOCK FULL TRACKING  ]             │
│                                          │
│  ⚡ 7-day free trial included           │
│  ⭐ 4.8/5 — 2,400 ratings              │
└─────────────────────────────────────────┘
```

**Триггеры:**
- Персонализированные данные → emotional ownership
- «Pro users save $180» — социальное доказательство + loss framing
- Рейтинг = social proof
- Reframing продукта как инвестиции, которая окупается

---

### 7.5 Обязательные изменения в коде пейволла

```typescript
// ФИКС 1: Default yearly, не monthly
const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly'); // ← было 'monthly'

// ФИКС 2: Убрать Free plan с пейволла (или сделать последним + неактивным по умолчанию)
const [selected, setSelected] = useState('pro'); // без возможности выбрать free как дефолт

// ФИКС 3: Yearly план с визуальным акцентом
// Добавить "BEST VALUE" badge на yearly
// Показывать savings в $, не только в %

// ФИКС 4: Уменьшить close button
// closeBtn → position: absolute, top: 8, right: 8, opacity: 0.4
// Первые 3 секунды — не показывать (delayed close)

// ФИКС 5: Добавить social proof
const TESTIMONIALS = [
  { text: "Saved $180 in my first month!", stars: 5 },
  { text: "Found 4 subscriptions I forgot about", stars: 5 },
];
```

---

## SECTION 8 — RETENTION

### 8.1 Push-стратегия

| Push тип | Триггер | Текст | Время |
|----------|---------|-------|-------|
| Renewal Warning | 3 дня до списания | «🔔 Netflix renews in 3 days — $15.49» | 10:00 утра |
| Renewal Warning | 1 день до списания | «⚠️ Tomorrow: Spotify charges $9.99» | 18:00 |
| Trial Expiry | 2 дня до конца триала | «Your free trial ends in 2 days» | 10:00 |
| Weekly Report | Каждое воскресенье | «📊 You spent $X on subscriptions this week» | 11:00 |
| Monthly Insight | 1-е число месяца | «January recap: $X on 8 subscriptions» | 09:00 |
| Win-Back | 7 дней неактивности | «👀 3 subscriptions renewing this week» | 14:00 |
| Savings Discovery | При AI-находке | «🤖 Found a subscription you might have forgotten» | real-time |

### 8.2 Weekly Insights Email/Push

```
Subject: Your week in subscriptions 💳

This week:
• 2 subscriptions renew  ($32.48 total)
• You've saved $0 vs last month  
• Netflix price increased — you may want to review

→ View full report
```

### 8.3 Retention Loops

**Loop 1: Renewal Anxiety Loop**
```
Push (renewal warning) → App open → Review subscription → 
(keep/cancel decision) → Feel in control → Trust Bratar → Stay
```

**Loop 2: Monthly Insight Loop**
```
Monthly spend report → «Wow, $X» → Share with friend → 
New install → Social proof loop
```

**Loop 3: Discovery Loop**
```
AI находит подписку → Notification → App open → Add subscription → 
Portfolio grows → More invested in app
```

### 8.4 Cancellation Interception

Когда пользователь пытается отписаться (уже реализован `CancellationInterceptModal`):

```
Шаг 1: «Wait — here's what you'll lose»
- List конкретных ценностей (X tracked, Y saved)

Шаг 2: «Can we offer you a pause instead?»  
- Pause plan на 1 мес (бесплатно) → retention

Шаг 3: Если всё же отписывается → win-back через 30 дней
```

---

## SECTION 9 — BACKEND (NESTJS)

### 9.1 Analytics Events Storage Schema

```sql
-- analytics_events таблица
CREATE TABLE analytics_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  event_name  VARCHAR(100) NOT NULL,
  properties  JSONB DEFAULT '{}',
  session_id  VARCHAR(100),
  platform    VARCHAR(20) DEFAULT 'ios',
  app_version VARCHAR(20),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);

-- Conversion funnel view
CREATE VIEW conversion_funnel AS
SELECT 
  DATE_TRUNC('week', created_at) as week,
  event_name,
  COUNT(DISTINCT user_id) as unique_users
FROM analytics_events
WHERE event_name IN (
  'onboarding_started', 
  'onboarding_completed',
  'subscription_first_added',
  'paywall_viewed',
  'trial_started',
  'purchase_completed'
)
GROUP BY 1, 2
ORDER BY 1, 2;
```

### 9.2 Renewal Detection Schema

```sql
-- subscription_renewals таблица
CREATE TABLE subscription_renewals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id     UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES users(id),
  renewal_date        DATE NOT NULL,
  amount              DECIMAL(10,2),
  currency            VARCHAR(3),
  status              VARCHAR(20) DEFAULT 'upcoming', -- upcoming | completed | skipped | cancelled
  notification_sent   BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_renewals_date ON subscription_renewals(renewal_date);
CREATE INDEX idx_renewals_user ON subscription_renewals(user_id, renewal_date);
```

### 9.3 Cron Jobs (NestJS)

```typescript
// src/cron/renewal-notifications.cron.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class RenewalNotificationsCron {
  
  // Каждый день в 9:00 UTC
  @Cron('0 9 * * *')
  async sendRenewalReminders() {
    // Найти все подписки, которые обновляются через 3 дня
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const upcomingRenewals = await this.subscriptionsRepo
      .createQueryBuilder('sub')
      .innerJoinAndSelect('sub.user', 'user')
      .where('DATE(sub.nextBillingDate) = :date', {
        date: threeDaysFromNow.toISOString().split('T')[0],
      })
      .andWhere('sub.status = :status', { status: 'active' })
      .andWhere('user.fcmToken IS NOT NULL')
      .getMany();

    for (const sub of upcomingRenewals) {
      await this.notificationsService.sendPush({
        token: sub.user.fcmToken,
        title: `🔔 ${sub.name} renews in 3 days`,
        body: `${sub.formattedAmount} will be charged on ${sub.nextBillingDate}`,
        data: { type: 'renewal_reminder', subscriptionId: sub.id },
      });
    }
  }

  // Каждое воскресенье в 11:00 UTC
  @Cron('0 11 * * 0')
  async sendWeeklyReports() {
    const activeUsers = await this.usersRepo
      .createQueryBuilder('user')
      .innerJoin('user.subscriptions', 'sub')
      .where('user.fcmToken IS NOT NULL')
      .andWhere('user.lastActiveAt > :date', {
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      })
      .getMany();

    for (const user of activeUsers) {
      const weeklyStats = await this.analyticsService.getWeeklyStats(user.id);
      await this.notificationsService.sendPush({
        token: user.fcmToken,
        title: `📊 Weekly: $${weeklyStats.totalAmount} in subscriptions`,
        body: `${weeklyStats.renewingCount} renewals this week`,
        data: { type: 'weekly_report' },
      });
    }
  }

  // Каждый день в 08:00 — trial expiry warnings
  @Cron('0 8 * * *')
  async sendTrialExpiryWarnings() {
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const expiringTrials = await this.billingRepo
      .createQueryBuilder('billing')
      .innerJoinAndSelect('billing.user', 'user')
      .where('DATE(billing.trialEndsAt) = :date', {
        date: twoDaysFromNow.toISOString().split('T')[0],
      })
      .andWhere('billing.status = :status', { status: 'trialing' })
      .getMany();

    for (const billing of expiringTrials) {
      await this.notificationsService.sendPush({
        token: billing.user.fcmToken,
        title: `⏰ Your free trial ends in 2 days`,
        body: `Upgrade to Pro to keep all your subscription data`,
        data: { type: 'trial_expiry' },
      });
    }
  }
}
```

### 9.4 Subscription Renewal Auto-Detection

```typescript
// Cron: обновляем nextBillingDate после каждого renewal
@Cron('0 0 * * *')
async updateNextBillingDates() {
  const today = new Date();
  const expiredSubscriptions = await this.subscriptionsRepo.find({
    where: { nextBillingDate: LessThanOrEqual(today), status: 'active' },
  });

  for (const sub of expiredSubscriptions) {
    sub.nextBillingDate = calculateNextBillingDate(
      sub.nextBillingDate,
      sub.billingCycle,
    );
    await this.subscriptionsRepo.save(sub);
    
    // Создать запись в renewals
    await this.renewalsRepo.save({
      subscriptionId: sub.id,
      userId: sub.userId,
      renewalDate: today,
      amount: sub.amount,
      currency: sub.currency,
      status: 'completed',
    });
  }
}

function calculateNextBillingDate(current: Date, cycle: string): Date {
  const next = new Date(current);
  switch (cycle) {
    case 'monthly': next.setMonth(next.getMonth() + 1); break;
    case 'yearly':  next.setFullYear(next.getFullYear() + 1); break;
    case 'weekly':  next.setDate(next.getDate() + 7); break;
    case 'quarterly': next.setMonth(next.getMonth() + 3); break;
  }
  return next;
}
```

---

## SECTION 10 — CREATIVE STRATEGY (TIKTOK)

### 20 TikTok Scripts

---

**Script 1: «Bank Statement Shock»**
```
HOOK:    «POV: You're checking your bank statement at 2am»
PROBLEM: Scroll through charges — Netflix, Spotify, Apple, forgotten SaaS tool,
         gym app you haven't opened in 8 months — total: $312/month
DEMO:    Open Bratar → instant list of all subscriptions → total shocked expression
CTA:     «Download Bratar and find yours in 60 seconds»
```

**Script 2: «The Free Trial Trap»**
```
HOOK:    «The free trial trick companies use to steal from you»
PROBLEM: Sign up for free trial → forget to cancel → charged for 6 months
DEMO:    Show trial expiry countdown in Bratar, receive push notification before charge
CTA:     «Never get trapped again»
```

**Script 3: «What $300/month Actually Buys»**
```
HOOK:    «Most people are spending $300/month on subscriptions without knowing it»
PROBLEM: List out common subscriptions → add them up live
DEMO:    Add all of them to Bratar → see $347 total → expression of shock
CTA:     «What's YOUR number? Find out for free»
```

**Script 4: «I Found $200 I Was Wasting»**
```
HOOK:    «I found $200/month I was wasting. Here's how»
PROBLEM: Opened Bratar for the first time after a friend recommended it
DEMO:    Show scan results — 11 subscriptions, $247/month, 3 forgotten ones
CTA:     «Link in bio — it's free to try»
```

**Script 5: «Every Subscription You're Paying For Right Now»**
```
HOOK:    «Let me guess your subscriptions» [points at camera]
PROBLEM: List the most common ones — bet 8/10 viewers have at least one forgotten
DEMO:    Bratar dashboard with all common services
CTA:     «See yours — link in bio»
```

**Script 6: «The Netflix Price Increase Alert»**
```
HOOK:    «Netflix raised prices again and most people don't know»
PROBLEM: Companies sneak in price increases — you keep paying more without noticing
DEMO:    Bratar price change alert feature
CTA:     «Set up price alerts — it's free»
```

**Script 7: «Subscription Math»**
```
HOOK:    «The math on subscriptions will make you sick»
PROBLEM: $15 feels cheap → $15 × 12 months = $180/year just for Netflix
         Add 10 subscriptions → $1,800–2,400/year you barely thought about
DEMO:    Bratar annual cost view
CTA:     «See your annual total»
```

**Script 8: «Corporate Confession»**
```
HOOK:    «Former SaaS employee confesses how they keep you paying»
PROBLEM: Dark patterns: hard cancel, hidden billing dates, confusing tiers
DEMO:    Bratar tracks all renewals, cancellation links
CTA:     «Don't let them win»
```

**Script 9: «The Duplicate Subscription»**
```
HOOK:    «I had 3 cloud storage subscriptions at the same time»
PROBLEM: iCloud AND Google One AND Dropbox — $24/month for storage overlap
DEMO:    Bratar showing category overlap, duplicates
CTA:     «How many duplicates do YOU have?»
```

**Script 10: «60 Second Challenge»**
```
HOOK:    «Add up all your subscriptions in 60 seconds»
PROBLEM: Most people guess wrong by 50%+
DEMO:    Live timer — add subscriptions via voice → result vs guess
CTA:     «Try it yourself, link in bio»
```

**Script 11: «The App You Forgot About»**
```
HOOK:    «Name an app you're still paying for but never open»
PROBLEM: Headspace from 2021? Calm? That meditation app? They're still charging you.
DEMO:    Bratar finds inactive subscription patterns
CTA:     «Find yours before they charge again»
```

**Script 12: «Reaction to My Total»**
```
HOOK:    «Checking my subscription total for the first time... 😱»
PROBLEM: Just genuine reaction — it's high
DEMO:    Screen recording of Bratar dashboard, real (or realistic) numbers
CTA:     «What's your total? Comment below»
```

**Script 13: «The $1/Week Argument»**
```
HOOK:    «$1/week app that saved me $200»
PROBLEM: Paying $2.99/month = $1/week for Bratar
DEMO:    Show how it caught 2 forgotten subscriptions worth $35/month
CTA:     «Download — first 7 days free»
```

**Script 14: «AI Reads Your Screenshot»**
```
HOOK:    «This AI can detect your subscriptions from a screenshot»
PROBLEM: Show a blurred bank statement screenshot
DEMO:    Upload to Bratar → AI extracts all subscription charges → adds them
CTA:     «Try the AI for free»
```

**Script 15: «Student Budget Edition»**
```
HOOK:    «Student spending $400/month on subscriptions he doesn't use»
PROBLEM: Student debt + unnecessary subscriptions = financial spiral
DEMO:    Student uses Bratar → cancels 4 services → saves $67/month
CTA:     «Free for students this month»
```

**Script 16: «The Subscription Audit»**
```
HOOK:    «I audited my subscriptions and deleted $180/month»
PROBLEM: No one does regular subscription audits
DEMO:    Walk through each subscription — keep/cancel decision with Bratar
CTA:     «Do your own audit — it's free»
```

**Script 17: «Before vs After»**
```
HOOK:    «My subscription spending BEFORE and AFTER Bratar»
PROBLEM: Before: $340/month, no visibility, 3 forgotten subs
DEMO:    After: $167/month, full clarity, renewal alerts enabled
CTA:     «What's your before?»
```

**Script 18: «The Gym App Problem»**
```
HOOK:    «Paying for a gym app since January 2023. Never opened it.»
PROBLEM: Specific, relatable — Fitness+ / Nike Training / Peloton subscriptions
DEMO:    Find and cancel in Bratar
CTA:     «What's your unused subscription? Drop it in comments»
```

**Script 19: «Renewal Alert Saves the Day»**
```
HOOK:    «Bratar literally saved me $120 this morning»
PROBLEM: Got push notification — annual Adobe plan renewing tomorrow, $120
         Had forgotten about it completely
DEMO:    Show notification → open Bratar → see renewal → go cancel in time
CTA:     «Download before YOUR next renewal»
```

**Script 20: «Family Plan Math»**
```
HOOK:    «My family has 3 Netflix accounts»
PROBLEM: Mom, Dad, adult son — all separate accounts. $45/month vs $22.99 family
DEMO:    Bratar Team plan shows family overlaps
CTA:     «Cut your family's subscription bill in half»
```

---

## SECTION 11 — BUDGET PLAN

### 11.1 Phase 1: Test ($500)

**Цель:** Найти конвертирующие ключевые слова и креативы. Не масштабировать убыточное.

| Канал | Бюджет | Ожидание |
|-------|--------|----------|
| Apple Search Ads (Search Match) | $350 | 87–233 installs |
| Apple Search Ads (Brand + Category) | $150 | 37–100 installs |

**Результат при CPI $2.50:**
- Installs: ~200
- Триалы (20%): 40
- Paid (33%): 13
- CAC: $38.5
- Revenue (blended): $13 × $22 = $286 net

**Что измерять:** CTR по кейвордам, CPI по типам кампаний, install→trial rate

---

### 11.2 Phase 2: Validation ($1,500–3,000)

**Цель:** Подтвердить unit economics. Найти CAC < $25.

| Канал | Бюджет | Ожидание |
|-------|--------|----------|
| Apple Search Ads (Exact Match) | $1,200 | 480–800 installs |
| Apple Search Ads (Discovery) | $600 | 150–400 installs |
| TikTok (production + promotion) | $300 | organic + 50–100 installs |
| ASO (разовые работы) | $200 | органика +20–40% |

**Результат при CPI $2.20, conv 7%:**
- Paid installs: ~820
- Paid users: ~57
- Organic bonus: +20%
- Total paid: ~68
- Revenue net: ~$1,700
- CAC: ~$22 ✅

---

### 11.3 Phase 3: Scale ($3,000–5,000/мес)

**Цель:** Масштаб при позитивном LTV/CAC.

| Канал | Бюджет % | KPI |
|-------|----------|-----|
| Apple Search Ads | 60% | CPA < $20, ROAS > 200% |
| Meta (retargeting) | 20% | Retarget trial drop-offs |
| TikTok Organic | 10% | 3–5 видео/нед, 100K+ views |
| Influencer / UGC | 10% | 2–3 micro-influencer/нед |

**При $4,000/мес и CPI $2.00, conv 10%:**
- Installs: 2,000
- Paid: 200
- Revenue (net, blended): 200 × $22 = $4,400
- ROAS: 110% → ещё не прибыльно без retention
- С 12M LTV: 200 × $25.5 = $5,100 → ROAS 127% ✅

**Break-even при масштабе:**
- Нужен organic mix 30%+ → blended CPI $1.40
- Нужен annual mix 50%+ → blended LTV $28+
- CAC target: < $18 → LTV/CAC > 1.5x

---

## SECTION 12 — 30-DAY ROADMAP

### Week 1: Foundation (Дни 1–7)

**Analytics:**
- [ ] Интегрировать Amplitude (или Mixpanel/Firebase)
- [ ] Внедрить `analytics.ts` сервис во все ключевые экраны
- [ ] Настроить funnel: install → first_sub_added → paywall → trial → paid
- [ ] Проверить все события через debug mode

**Paywall fix (критично):**
- [ ] Сменить default на `yearly`
- [ ] Убрать Free план как дефолтный выбор
- [ ] Уменьшить close button + добавить 3-секундный delay
- [ ] Добавить social proof (1 отзыв с деньгами)
- [ ] Проверить что copywriting показывает savings в $

**Onboarding:**
- [ ] Добавить money loss hook на шаг 1
- [ ] Внедрить «добавь первую подписку» на шаг 2 (quick-add карточки)
- [ ] Переместить auth ПОСЛЕ добавления первой подписки

### Week 2: Launch (Дни 8–14)

**ASO:**
- [ ] Обновить subtitle → «Stop Paying for What You Don't Use»
- [ ] Создать 5 новых screenshots с конкретными цифрами
- [ ] Оптимизировать description (первые 3 строчки = hook)
- [ ] Отправить на App Store review

**Apple Search Ads ($500 тест):**
- [ ] Создать Search Match кампанию
- [ ] Добавить brand + category кейворды
- [ ] Настроить Attribution → Amplitude
- [ ] Запустить

**Push notifications:**
- [ ] Настроить cron renewal reminder (3 дня до)
- [ ] Настроить trial expiry warning (2 дня до)
- [ ] Протестировать на реальных пользователях

### Week 3: Optimize (Дни 15–21)

**Data review:**
- [ ] Проанализировать funnel данные (7 дней)
- [ ] Найти главный drop-off шаг
- [ ] A/B тест: paywall Variant A vs Variant B

**Creative:**
- [ ] Снять 3 TikTok видео (script 1, 3, 12)
- [ ] Загрузить в TikTok + Instagram Reels
- [ ] Отследить просмотры + перемещения в AppStore

**Search Ads:**
- [ ] Перейти на Exact Match для топ-конвертеров
- [ ] Отключить кейворды с CTR < 1%
- [ ] Добавить негативные кейворды

### Week 4: Scale (Дни 22–30)

**Если unit economics позитивны:**
- [ ] Увеличить ASA бюджет до $1,500–2,000
- [ ] Создать Custom Product Pages (3 варианта)
- [ ] Запустить Discovery кампанию

**Retention:**
- [ ] Weekly insights push (воскресенье 11:00)
- [ ] Win-back push для 7-дневных неактивных
- [ ] Cancellation interception flow

**Team план:**
- [ ] Уточнить позиционирование Team для семей/фрилансеров
- [ ] Добавить upsell trigger после добавления 5+ подписок

---

## SECTION 13 — CODE IMPROVEMENTS

### 13.1 Критические проблемы

#### A. Нет аналитики (BLOCKER)
```typescript
// Сейчас: нет tracking service
// Нужно: полноценный analytics.ts с Amplitude/Mixpanel
// Без этого нельзя оптимизировать воронку
```

#### B. Paywall — default monthly
```typescript
// app/paywall.tsx:69
const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
// → должно быть 'yearly'
```

#### C. Отсутствие A/B тестирования
```typescript
// Нет инфраструктуры для A/B тестов paywall
// Нужен: feature flags через Firebase Remote Config или Amplitude Experiment
```

#### D. Нет deep links
```typescript
// Нет universal links / deep links для:
// - paywall/trial CTA из push notifications
// - referral links
// Нужно добавить expo-linking + ASA attribution
```

#### E. Onboarding не форсирует активацию
```typescript
// app/onboarding.tsx — только slides, нет forced action
// Критически важно для conversion
```

### 13.2 Производительность

```typescript
// Dashboard screen (app/(tabs)/index.tsx)
// Проблема: fetchSubscriptions + fetchAnalytics — отдельные запросы при каждом открытии
// Решение: использовать TanStack Query с staleTime

const { data: subscriptions } = useSubscriptions({
  staleTime: 5 * 60 * 1000, // 5 минут кеш
  gcTime: 10 * 60 * 1000,
});

// Проблема: нет skeleton loading → пользователь видит пустой экран
// Решение: добавить SkeletonPlaceholder компонент
```

### 13.3 Слабые места в монетизации

```typescript
// 1. Нет upsell триггера при достижении лимита (3 подписки free plan)
// Добавить: при попытке добавить 4-ю — показать paywall с контекстом

// 2. Нет Annual upgrade prompt для monthly subscribers
// Добавить: через 30 дней на monthly — «Switch to yearly, save $8.88»

// 3. Нет referral программы
// Добавить: «Invite a friend — get 1 month free» (viral loop)
```

### 13.4 Инфраструктура (Backend)

```typescript
// Нет analytics endpoint для хранения событий
// Нет renewal auto-calculation при сохранении подписки
// Нет user segmentation (trialing, monthly, yearly, churned)
// Нет webhook от RevenueCat для автоматической синхронизации статусов
```

---

## SECTION 14 — LTV GROWTH

### 14.1 Как толкать в Annual

**Тактика 1: Default Annual на пейволле** (самая высокая отдача)
- Просто сменить default → +20–30% annual mix

**Тактика 2: Annual Upgrade Nudge (через 30 дней monthly)**
```
Push: "Switch to yearly and save $8.88. You've been Pro for 30 days — lock in the savings."
In-app: баннер на settings экране
```

**Тактика 3: Annual Exclusive Features**
```
PDF Reports → только на yearly (или Pro + 12+ месяцев)
Advanced AI credits → extra batch на yearly
```

**Тактика 4: Year-End Sale**
```
«December only: Yearly Pro for $19.99» (вместо $27)
Urgency + savings = conversion spike
```

### 14.2 Снижение Churn

| Момент | Действие |
|--------|----------|
| Day 3 после purchase | Onboarding success email: «You've saved X already» |
| Day 7 | «Вы отслеживаете X подписок на $Y/мес» |
| Day 30 | Monthly recap — первый полный месяц |
| Trial day 5 | Urgency: «2 days left — lock in your data» |
| Cancellation attempt | Interception modal + pause offer |
| Post-cancellation (day 30) | Win-back: «3 renewals happening this week» |

### 14.3 Team Plan Upsell

**Триггер:** пользователь добавил 5+ подписок (значит вовлечён).

**Copy:**
```
"Share Bratar with your family or team"
"Split the cost: Team plan = $2.50/person for 4 people"
"Spot overlapping subscriptions across your household"
```

**Moment:** при добавлении 5-й подписки → тихий banner: «Did you know you can share Bratar with family for $9.99/month total?»

---

## SECTION 15 — WHAT TO BUILD NEXT

### High Impact, Low Effort (приоритет 1)

**1. Annual Upgrade In-App Banner**
- Для monthly подписчиков после 30 дней
- «Save $8.88/year → Switch to Annual»
- Эффект: +15–25% annual mix

**2. Onboarding Forced First Subscription**
- Добавить quick-add cards на шаг 2
- Эффект: +40–60% activation rate

**3. Analytics Integration**
- Amplitude или Firebase
- Эффект: данные для всех остальных решений

**4. Paywall Default Yearly**
- 1 строка кода
- Эффект: +20–30% annual conversions

---

### High Impact, Medium Effort (приоритет 2)

**5. Referral Program**
```typescript
// Схема: invite friend → both get 1 month free
// Viral loop: каждый paying user приводит 0.3–0.5 новых
// При 1000 paid users → +300–500 органических installs
```

**6. Subscription Import from Bank (via email/SMS parsing)**
- User forwards bank email → AI extracts subscriptions
- Aha-moment: «Found 8 subscriptions automatically»
- Retention: users с большим числом подписок уходят реже

**7. Price Change Alerts**
```typescript
// Backend мониторит изменения цен в популярных сервисах
// Push: «Netflix raised prices by $2. Your new cost: $17.49/month»
// High retention value — уникальная фича vs конкурентов
```

**8. «Cancel Guide» Feature**
```typescript
// For each subscription — прямая ссылка на страницу отмены + инструкция
// «Hard to cancel» subscriptions как главная боль пользователей
// Retention driver: users открывают app перед cancellation
```

---

### Medium Impact (приоритет 3)

**9. Widgets (iOS Home Screen)**
- «$X renewing this month» на Home Screen
- Daily reminder о продукте без открытия
- Retention: +20–30% D30 retention

**10. Categories Spending Goals**
- «Entertainment budget: $50/month» — alert при превышении
- Transforms app from tracker → financial manager
- LTV driver: более глубокое вовлечение

**11. Shared Subscriptions (Team Feature)**
- «Split Netflix with 4 friends — $3.87 each»
- Team plan activation + viral feature
- Drives Team plan conversions

---

## FINANCIAL TARGETS

| Метрика | Месяц 1 | Месяц 3 | Месяц 6 |
|---------|---------|---------|---------|
| Monthly Installs | 500 | 2,000 | 5,000 |
| Paying Users | 35 | 175 | 600 |
| MRR (net) | $770 | $3,850 | $14,000 |
| Annual Mix | 30% | 50% | 60% |
| Blended CAC | $40 | $22 | $15 |
| LTV/CAC | 0.6x | 1.2x | 1.9x |

**Break-even:** ~Месяц 4–5 при правильном execution onboarding + paywall fixes + ASO.

---

> **Приоритет #1:** Починить paywall (default yearly + убрать Free как дефолт) + добавить analytics.
> Это можно сделать за 2 дня и даст +30–50% к revenue без единого нового пользователя.
