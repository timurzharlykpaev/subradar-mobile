# Currency Conversion for Popular Services & Regional Catalog

**Date:** 2026-04-16  
**Status:** Approved  
**Scope:** Phase A (client FX) + Phase B (regional catalog)

---

## Проблема

POPULAR_SERVICES (20 пресетов) имеют хардкод USD цены. При displayCurrency=KZT пользователь видит "$13.99" вместо "~6 400 ₸". После добавления подписка сохраняется как USD, бэкенд конвертирует для display — но на этапе выбора тарифа конвертации нет.

## Архитектура

### Phase A: Клиентский FX-кеш

**Новый файл:** `src/services/fxCache.ts`

- `fetchRates()` — `GET /fx/rates` → кеш в AsyncStorage (`subradar:fx-rates`), TTL 6 часов
- `convertAmount(amount, from, to)` → `amount / rates[from] * rates[to]` (Decimal-like)
- `getCachedRates()` — синхронное чтение из памяти (загружено при старте)
- Fallback: если курсы не загружены → возвращает `null`, вызывающий код показывает оригинальную валюту

**Жизненный цикл:**
1. `DataLoader` (app/_layout.tsx) → `fxCache.init()` при старте
2. `settingsStore.setDisplayCurrency()` → `fxCache.invalidate()` → refetch
3. `InlineConfirmCard` / чипы → `fxCache.convertAmount()` синхронно из кеша в памяти

**Бэкенд:** `GET /fx/rates` (`FxController`) — проверить что отдаёт `{ base, rates, fetchedAt }`.

**InlineConfirmCard изменения:**
- Тарифы: `convertAmount(plan.priceMonthly, plan.currency, displayCurrency)` → `formatMoney(converted, displayCurrency)`
- Fallback: `plan.priceMonthly.toFixed(2) plan.currency`
- `handlePlanSelect`: конвертированная сумма + displayCurrency, или оригинал если нет курсов

**При сохранении:** подписка создаётся с валютой из формы (KZT если конвертация прошла, USD если нет). Бэкенд хранит как originalCurrency.

### Phase B: Региональный каталог

**Бэкенд: новый эндпоинт** `GET /catalog/popular?region=KZ&currency=KZT`

1. Ищет в `catalog_services` + `catalog_plans` цены для региона
2. Если нет → AI lookup для каждого сервиса, кеширует в БД
3. Ответ: массив сервисов с планами в региональной валюте

**Предзаполнение:** Cron раз в неделю — топ-20 × 6 регионов (US, KZ, RU, UA, TR, EU).

**Клиент:**
- `AddSubscriptionSheet` при открытии → `GET /catalog/popular`
- Кеш в AsyncStorage 24ч
- Заменяет POPULAR_SERVICES данными каталога
- Fallback цепочка: каталог → FX-конвертация → хардкод USD

### Реактивность

- `setDisplayCurrency()` → инвалидация FX-кеша + refetch
- `setRegion()` → инвалидация каталожного кеша + refetch
- Подписки/аналитика — уже реактивны (useEffect на currency)

## Порядок реализации

### Phase A
1. `src/services/fxCache.ts` — fetch + кеш + конвертация
2. Бэкенд: проверить `GET /fx/rates` формат
3. `InlineConfirmCard` — конвертация тарифов
4. `AddSubscriptionSheet` — конвертация чипов
5. `DataLoader` — prefetch курсов
6. Реактивность при смене displayCurrency

### Phase B
1. Бэкенд: `GET /catalog/popular` эндпоинт
2. Бэкенд: cron предзаполнения
3. Клиент: загрузка каталога
4. Клиент: кеш каталога
5. Fallback цепочка

## Что НЕ входит

- Изменение логики сохранения подписок
- Изменение display layer (effectiveCurrency, SubscriptionCard)
- Миграции БД

## Риски

- FX офлайн → fallback на USD с явным показом валюты
- AI lookup неточные цены → пользователь редактирует перед добавлением
- Каталог устаревает → cron раз в неделю
