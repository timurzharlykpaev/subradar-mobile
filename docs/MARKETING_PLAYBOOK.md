# SubRadar — Marketing & Growth Playbook

Практическое руководство по привлечению: какие каналы, как настраивать, что
делать по этапам. Обновляется по мере накопления данных.

> **Принцип №1.** Канал — не бутылочное горлышко. Сейчас главная дыра —
> **установка → регистрация ≈ 0**. Любой платный канал бесполезен, пока юзеры
> не доходят до регистрации. Сначала чиним воронку (PostHog покажет где),
> потом масштабируем закупку.

---

## 1. Приоритет каналов (для трекера подписок)

| Канал | Роль | Почему |
|-------|------|--------|
| **Apple Search Ads (ASA)** | основной платный | Ловит высокий интент — людей, которые прямо ищут «subscription tracker / cancel subscriptions». Дёшево, чистая атрибуция. |
| **Органика (Reels/TikTok/Shorts)** | основной по ROI | $0. Использовать ролики из `subradar-kling-ads`. Тестировать месседж бесплатно. |
| **ASO** (App Store Optimization) | фундамент | Title/subtitle/keywords → влияет и на ASA-релевантность, и на органику. |
| **Meta (IG+FB)** | вторично | Лучше TikTok для финтех-утилит, но дороже и ATT подрезал таргетинг. Подключать когда воронка доказана. |
| **TikTok paid** | в последнюю очередь | Холодный трафик, низкий интент к платному трекеру. |

**Правило:** не распыляться. Один платный канал (ASA) + органика + чинить
воронку. Масштаб — после доказанной экономики.

---

## 2. Apple Search Ads — пошаговая оптимизация

### Структура (правильная цель)
- Тип кампании: **Search Results** (не Display/Search tab).
- Гео: англоязычные дорогие рынки (US/CA/UK/AU/SG) — НЕ KZ (там нет объёма).
- Стратегия ставок: ручная (Управление ставками) пока учишься; позже можно
  «Максимизация конверсий» с целевым CPA.

### ЭТАП 1 — Исключающие ключи (negative keywords, exact)
Самый важный фикс. Широкие ключи ловят бренды НЕ из твоей ниши (страховые,
дележ счетов, B2B). Добавить в негативы:
```
splitwise, tricount            # приложения дележа счетов
youi, youi insurance, insurance, budget direct   # страховые
ia financial, ia financial group, ia mobile, envision, envision financial  # банки/КС
sap concur, concur, equals     # B2B/enterprise
pocketly, spriggy, molly       # чужой финтех
neat bill, pret, get, get app, get mobile, island savings, au ru  # мусор
```

### ЭТАП 2 — Выключить ключи (пауза)
Общие, 0 установок, тянут только мусор:
```
finance app, ai finance app, expense manager,
money manager, personal finance, financial planner, bill tracker
```

### ЭТАП 3 — Перевести в ТОЧНОЕ соответствие (exact)
Чтобы перестали ловить бренды:
```
budget app, money tracker, savings app, spending tracker,
expense tracker, budget tracker, bill reminder
```

### ЭТАП 4 — Поднять биды на победителей
Эти уже дают установки / высокий TTR:
| Ключ | Бид |
|------|-----|
| money tracker | $2.50 |
| savings app | $2.50 |
| spending tracker | $2.00 |
| free trial reminder | $2.00 |
| **rocket money** | **$2.50** (был $0.10 — мёртвый) |

### ЭТАП 5 — Добавить ключи (exact)
**Ядро (прямая аудитория), бид $2:**
```
subscription tracker, subscription tracker app, track subscriptions,
manage subscriptions, cancel subscriptions, subscription manager,
recurring payments, subscription reminder, unused subscriptions,
forgotten subscriptions
```
**Конкуренты (кто ищет аналог = твой клиент), бид $2:**
```
truebill, bobby app, emma app, monarch money, copilot money, subby
```

### ЭТАП 6 — Search Match
Не выключать, опустить дефолтный бид до **$0.40** — пусть дёшево ищет новые
запросы. Раз в 3 дня: хорошие запросы → в exact, мусор → в негативы.

### ЭТАП 7 — Лимит CPA
Настройки группы → «Лимит цены за конверсию (CPA)» → **$5**.

### Бенчмарки (на что смотреть)
| Метрика | Плохо | Норма |
|---------|-------|-------|
| TTR (tap-through rate) | <1% | 8–15%+ |
| tap→install (CVR) | <30% | 50–70% |
| CPA (цена установки) | >$6 | $2–4 |

**Диагностика «мало кликов»:** подними бид ×1.5 на день. Показы выросли → было
в ставке. Не выросли → проблема в объёме/гео/релевантности/негативах.

---

## 3. Креатив (страница в App Store)

Если целевые ключи (`cancel subscriptions`, `track subscriptions`) получают
показы, но 0 кликов — проблема в **иконке/скриншотах**, не в ключах.
- Первый скриншот: бить в боль — «Track every subscription. Cancel what you
  forgot. Stop wasting money.»
- Custom Product Pages (CPP) — отдельная страница под subscription-интент.

---

## 4. Аналитика и атрибуция (что вшито в приложение)

| Инструмент | Состояние | Где смотреть |
|-----------|-----------|--------------|
| **PostHog** (EU, проект 193318) | вшит, активен с билда ≥1.4.15 | Дашборд 723413 — воронки онбординг→оплата, paywall→покупка, дневная активность |
| **Sentry** (проект subradar-mobile) | вшит, source maps + алерт | Краши по тегу environment (testflight/production) |
| **SKAdNetwork** | вшит (TikTok+Pangle ID) | Install-postback'и в рекламный кабинет |
| **ATT** | убран (премату́рно) | Вернуть вместе с TikTok SDK / MMP, который реально читает IDFA |
| **RevenueCat** | собирает ASA-токен атрибуции | Покупки/триалы автоматически |

**Воронка, которую смотреть в PostHog (где отваливается):**
```
app_open → onboarding_completed → auth_completed(=регистрация)
  → subscription_first_added → paywall_viewed → trial_started → purchase_completed
```
Сейчас самый дорогой обрыв — **install → auth_completed**. Это приоритет №1.

---

## 5. Платформенные каналы — как настраивать

### TikTok (если запускать)
1. Assets → подключить iOS-приложение.
2. Кампания: **App Promotion** (НЕ Traffic/Reach — иначе клики без установок).
3. Включить **iOS 14 Dedicated Campaign** (SKAN).
4. Цель оптимизации: старт `Install`, позже `In-App Purchase`.
5. Для покупок — RevenueCat постит SKAN value автоматически.

### Meta (когда воронка доказана)
- Advantage+ App Campaign, оптимизация на установки/покупки.
- Добавить Meta SKAdNetwork ID в `app.json` infoPlist.

### MMP (AppsFlyer/Adjust) — для сквозного измерения
Нужен, когда масштабируешь платную закупку и хочешь видеть
spend→install→trial→purchase по каждому каналу. Тогда же вернуть **ATT**
(он осмыслен только если MMP/SDK реально использует IDFA).

---

## 6. Еженедельная рутина
1. **ASA:** отчёт по поисковым запросам → новые конвертеры в exact, мусор в негативы.
2. **PostHog:** воронка install→register→pay — где упало, что чинить.
3. **Sentry:** новые краши → фиксить топовые.
4. **Биллинг:** конверсия free→trial→paid (`user_billing` в бэке).

---

## 7. Краткие правила
- Не масштабируй закупку, пока install→register не починен.
- ASA: релевантность (негативы + exact) важнее ставки.
- Органика (Kling-ролики) — самый дешёвый тест месседжа.
- Любой новый рекламный канал = свои SKAdNetwork ID в билд + новая сборка.
- ATT/IDFA добавлять только когда есть потребитель (MMP/SDK) — иначе это
  блок сабмита + лишний промпт + «tracks you» в App Privacy без пользы.
