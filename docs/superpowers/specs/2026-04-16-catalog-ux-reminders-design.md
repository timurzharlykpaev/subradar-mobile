# Regional Catalog Prices + Add Subscription UX + Reminders

**Date:** 2026-04-16
**Status:** Approved

---

## Проект 1: Каталог реальных региональных цен

### Проблема
FX-конвертация USD → KZT даёт неправильные цены. YouTube Premium Family: $22.99 × 475 = 10 901 ₸, реальная цена в KZ = 6 500 ₸. Компании устанавливают локальные цены на 30-60% ниже FX-конвертации.

### Решение

#### 1.1 AI промпты с явным регионом
**Файл:** `subradar-backend/src/catalog/ai-catalog.provider.ts`

System prompt для `fullResearch()` и `priceRefresh()` должен включать:
```
Research subscription plans for service "{name}" specifically for region: {region}.
Return prices in local currency ({currency}) if the service offers regional pricing.
For example, YouTube Premium in Kazakhstan costs ~2,390 KZT, not $13.99 converted.
If no regional pricing exists, return USD prices.
```

#### 1.2 Seed данных для 6 регионов × 20 сервисов
**Файл:** новый migration или seed script на бэкенде

Ручной seed реальных цен для:
- **Регионы:** US, KZ, RU, UA, TR, EU (DE как представитель)
- **Сервисы:** Netflix, YouTube, Spotify, Apple Music, Disney+, HBO Max, Amazon Prime, Apple TV+, ChatGPT, Claude, Notion, Figma, Slack, iCloud+, Google One, Xbox Game Pass, PlayStation Plus, GitHub Copilot, Adobe CC, NordVPN

Данные из реальных региональных страниц сервисов. Формат:
```sql
INSERT INTO catalog_plans (serviceId, region, planName, price, currency, period, priceSource, priceConfidence)
VALUES (:serviceId, 'KZ', 'Premium Family', 6500, 'KZT', 'MONTHLY', 'MANUAL', 'HIGH');
```

`priceSource: 'MANUAL'` — ручная проверка. `priceConfidence: 'HIGH'`.

#### 1.3 Cron bootstrap без юзеров
**Файл:** `subradar-backend/src/catalog/catalog-refresh.cron.ts`

Добавить 6 основных регионов в массив `regions` всегда (не только из `SELECT DISTINCT region FROM users`):
```typescript
const BASE_REGIONS = ['US', 'KZ', 'RU', 'UA', 'TR', 'DE'];
const userRegions = await this.userRepo.query('SELECT DISTINCT region FROM users WHERE region IS NOT NULL');
const regions = [...new Set([...BASE_REGIONS, ...userRegions.map(r => r.region)])];
```

## Проект 2: UX добавления подписки

### 2.1 Иконка в InlineConfirmCard
**Файл:** `subradar-mobile/src/components/InlineConfirmCard.tsx`

В header заменить fallback-букву на `<Image source={{ uri: iconUrl }}>` когда `iconUrl` доступен:
```tsx
{iconUrl ? (
  <Image source={{ uri: iconUrl }} style={styles.iconBox} />
) : (
  <View style={[styles.iconBox, { backgroundColor: colors.background }]}>
    <Text style={styles.iconLetter}>{name.charAt(0).toUpperCase()}</Text>
  </View>
)}
```

### 2.2 Дата следующего списания
**Файлы:** `InlineConfirmCard.tsx`, `AddSubscriptionSheet.tsx` (manual form)

Новое поле: "Дата следующего списания" с DatePicker.
- Дефолт: через 1 billing period от сегодня
- Пользователь может ввести реальную дату (подписка могла быть давно)
- Передаётся как `nextPaymentDate` в POST /subscriptions
- Если не указано — бэкенд вычисляет из `startDate + billingPeriod`

State: `const [nextDate, setNextDate] = useState(defaultNextDate())`

### 2.3 Предзаполнение напоминаний при добавлении
При создании подписки из InlineConfirmCard и manual form:
```typescript
reminderEnabled: true,
reminderDaysBefore: [2],
```

## Проект 3: Напоминания и "через N дней"

### 3.1 Дефолт напоминаний
**Файлы:** `AddSubscriptionSheet.tsx` (emptyForm), `InlineConfirmCard.tsx` (handleSave)

При создании любой подписки:
- `reminderEnabled: true` (сейчас false/отсутствует)
- `reminderDaysBefore: [2]` (за 2 дня до списания)

### 3.2 "Через N дней" в SubscriptionCard
**Файл:** `subradar-mobile/src/components/SubscriptionCard.tsx`

Под текущей датой следующего списания — серый текст:
```
через 15 дн     — серый, обычный
через 2 дн      — оранжевый
завтра           — оранжевый, жирный
сегодня          — красный, жирный
```

Логика:
```typescript
const daysUntilNext = subscription.nextPaymentDate
  ? Math.ceil((new Date(subscription.nextPaymentDate).getTime() - Date.now()) / 86400000)
  : null;
```

i18n ключи: `upcoming.in_days`, `upcoming.tomorrow`, `upcoming.today` (уже существуют).

### 3.3 settingsStore: дефолт напоминаний
**Файл:** `subradar-mobile/src/stores/settingsStore.ts`

Изменить дефолт:
```typescript
reminderDays: 2,  // было 3
notificationsEnabled: true,  // уже true
```

---

## Порядок реализации

### Фаза 1: Бэкенд (каталог)
1. AI промпты с регионом
2. Seed данных для 6 регионов × 20 сервисов
3. Cron bootstrap с BASE_REGIONS
4. Проверка: GET /catalog/popular?region=KZ&currency=KZT возвращает реальные KZ цены

### Фаза 2: Мобилка (UX добавления)
5. Иконка в InlineConfirmCard
6. Поле "дата следующего списания"
7. Предзаполнение reminderEnabled + reminderDaysBefore

### Фаза 3: Мобилка (напоминания + отображение)
8. "Через N дней" в SubscriptionCard
9. settingsStore дефолт reminderDays: 2

---

## Что НЕ входит
- Изменение FX-конвертации (уже работает как fallback)
- Миграции БД (catalog_plans уже поддерживает region)
- Кэширование каталога на клиенте (уже реализовано в catalogCache.ts)
- Изменения в аналитике
