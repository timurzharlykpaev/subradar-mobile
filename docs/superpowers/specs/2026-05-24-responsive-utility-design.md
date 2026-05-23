# Responsive Utility — Design Spec

**Date:** 2026-05-24
**Owner:** Timur
**Status:** Approved

## Проблема

Приложение SubRadar выглядит плохо на маленьких / узких экранах (iPhone 11 — отчёт пользователя, по факту 414×896; и хуже на SE 375×667, mini 375×812):

- Кнопки `actionsRow` на Dashboard "налезают" друг на друга при 3 элементах и длинных переводах
- Bottom sheets с фиксированной высотой `SCREEN_HEIGHT * 0.88` упираются в нотч и safe area на коротких экранах
- 834 хардкоженных `fontSize` в `StyleSheet.create` — нет единой точки масштабирования
- `Dimensions` / `useWindowDimensions` используется точечно (12 файлов), нет утилит и хука для responsive значений

Цели:
1. Системная утилита, применимая постепенно — **не переписывая весь код сразу**
2. **Не ломать существующий дизайн** на стандартных и крупных экранах (iPhone 13/14/15/Pro/Pro Max)
3. Аккуратно ужимать на SE/mini/iPhone 8 без потери читаемости
4. Точечно починить три самых видимых места: `actionsRow` Dashboard, sheet heights, текст с Dynamic Type

Не-цели:
- Не масштабируем вверх для планшетов / Pro Max (на больших экранах = 1.0)
- Не переписываем все 70+ компонентов одним PR — система применяется по мере касания + точечно в hot spots
- Не вводим NativeWind / styled-components / другие большие зависимости

## Архитектурное решение

Один новый файл `src/utils/responsive.ts` (~80 строк, 0 зависимостей) + хук `useResponsive()` (для реактивности на ротацию / смену window size).

### Базовый экран

```
BASE_WIDTH = 390   // iPhone 13/14 (средний современный)
BASE_HEIGHT = 844
```

### API

```ts
// Линейный horizontal scale (для ширины, иконок, картинок)
scale(size: number): number

// Линейный vertical scale (для высоты, vertical padding/margin)
verticalScale(size: number): number

// "Half-scale" (для шрифтов, border-radius, мелких отступов)
// Не уменьшает агрессивно: factor=0.5 → берёт половину от чистой пропорции
moderateScale(size: number, factor?: number): number

// Шорткаты
ms(size: number): number          // = moderateScale(size, 0.5)
mvs(size: number): number         // = moderateVerticalScale(size, 0.5)

// % от ширины / высоты экрана (для редких случаев, когда нужен % layout)
wp(percent: number): number
hp(percent: number): number

// Discrete helpers (для условной верстки)
isSmallScreen: boolean             // width < 380
isShortScreen: boolean             // height < 700
screenSize: 'small' | 'medium' | 'large'
```

### Capping (КЛЮЧЕВОЕ)

**Все scale-функции возвращают `size * 1.0` если фактический экран ≥ base.** То есть:

- iPhone 13/14/15 (390pt) → `ms(14) = 14` (без изменений)
- iPhone 11 (414pt) → `ms(14) = 14` (без изменений, шире базы)
- iPhone Pro Max (430pt) → `ms(14) = 14` (без изменений)
- iPhone 13/14 mini (375pt) → `ms(14) ≈ 13.5`
- iPhone SE/8 (375pt, 667 height) → `ms(14) ≈ 13.5`

Плюс **floor cap**: `scaleFactor` зажат в `[0.85, 1.0]` — максимальное снижение 15%. Это предотвращает мыльный текст и сохраняет читаемость на самых маленьких устройствах.

### Хук

```ts
const { ms, mvs, scale, isSmallScreen, width, height } = useResponsive();
```

Под капотом использует `useWindowDimensions()` (React Native), реактивен на ротацию и смену системного шрифта. Внутри хука те же `ms`/`mvs`, но переcчитанные относительно текущих window dimensions, а не закешированных при импорте.

### Использование

Постепенное:
- В **новом коде** — сразу `ms()` / `mvs()` через хук
- В **существующем коде** — статичный импорт `import { ms } from '@/utils/responsive'` (значения вычисляются один раз при загрузке модуля — это нормально, т.к. window dimensions при старте app уже известны)

## Точечные фиксы в этом же PR

### Fix 1: Dashboard `actionsRow` — кнопки налезают

`app/(tabs)/index.tsx:824`. Сейчас три `QuickAction` в ряд через `flexDirection: 'row'` + `flex: 1`.

**Решение:** на `isSmallScreen` (или когда `t('dashboard.upgrade_pro').length > 12`) — переключаем на сетку 2+1: первые две кнопки в ряд, третья (`upgrade_pro`) — отдельной строкой ниже full-width. Плюс `numberOfLines={2}` на label и `maxFontSizeMultiplier={1.2}` чтобы Dynamic Type не разносил высоту карточек.

Альтернатива (если 2+1 эстетически не нравится): уменьшить `padding: 14 → ms(14)` и `fontSize: 12 → ms(11)`, оставить 3 в ряд. Решаем в реализации, после визуальной проверки.

### Fix 2: Bottom sheet heights — `SCREEN_HEIGHT * 0.88` упирается в нотч

`src/components/BulkAddSheet.tsx:480`, `AddSubscriptionSheet.tsx`, `EditSubscriptionSheet.tsx`, `MemberDetailSheet.tsx`, `WelcomeSheet.tsx`.

**Решение:** заменить голый `SCREEN_HEIGHT * 0.88` на `useSafeAreaInsets()` + cap:

```ts
const sheetMaxHeight = Math.min(
  height * 0.9,
  height - insets.top - 24
);
```

Это даёт sheet'ам "дышать" под нотчем независимо от роста экрана.

### Fix 3: Dynamic Type — Larger Text не должен разносить layout

В критичных layout-блоках (heroAmount, action cards labels, табы, header titles, кнопки в ряд) добавить `maxFontSizeMultiplier={1.3}` или `allowFontScaling={false}` для абсолютно фиксированной верстки. Не глобально — точечно по hot spots, в первую очередь:

- `app/(tabs)/index.tsx`: hero amount, action labels, "currently overpaying" badge
- `app/(tabs)/_layout.tsx`: tabLabel
- `app/(tabs)/subscriptions.tsx`: list row сумма + название

Body-текст (descriptions, list items) — оставляем `allowFontScaling: true`, чтобы accessibility не сломать.

## Файлы

**Новые:**
- `src/utils/responsive.ts` (~80 строк)

**Изменяемые:**
- `app/(tabs)/index.tsx` — fix actionsRow + `maxFontSizeMultiplier` на hero/labels
- `app/(tabs)/_layout.tsx` — `maxFontSizeMultiplier` на tabLabel
- `app/(tabs)/subscriptions.tsx` — `maxFontSizeMultiplier` на list items
- `src/components/BulkAddSheet.tsx` — sheet height
- `src/components/AddSubscriptionSheet.tsx` — sheet height
- `src/components/EditSubscriptionSheet.tsx` — sheet height
- `src/components/MemberDetailSheet.tsx` — sheet height
- `src/components/WelcomeSheet.tsx` — sheet height

**НЕ трогаем в этом PR:**
- Остальные 60+ компонентов и экранов — мигрируем по мере касания
- Тему, цвета, переводы, бизнес-логику

## Тесты

Юнит-тест `src/__tests__/utils/responsive.test.ts`:

- `ms(14)` на `width=390` → `14` (no scaling)
- `ms(14)` на `width=414` → `14` (no scaling вверх)
- `ms(14)` на `width=375` → ~`13.5` (small scaling вниз)
- `ms(14)` на `width=320` → `~14 * 0.85` (clamped to floor)
- `wp(50)` на `width=400` → `200`
- `isSmallScreen` на `width=375` → `true`
- `isSmallScreen` на `width=390` → `false`

Юнит-тестов на конкретные экраны не пишем — там визуальная регрессия, проверяется руками на 3 устройствах:
1. iPhone SE simulator (375×667)
2. iPhone 14 Pro simulator (393×852)
3. iPhone 15 Pro Max simulator (430×932)

Acceptance: на всех трёх три проблемных места выглядят корректно, на 14 Pro и Pro Max — пиксель-в-пиксель идентично текущему main.

## Risks / Tradeoffs

- **Imports module-level vs hook**: статичный `import { ms }` вычисляется один раз. Если пользователь повернёт устройство — значения не обновятся. Это OK потому что app у нас **portrait-only** (см. `app.json`). Для будущей поддержки landscape — переход на `useResponsive()` хук.
- **Тесты не покрывают визуал**: компромисс ради скорости. Альтернатива — Detox/Maestro screenshot tests — overkill для текущего объёма.
- **Cap на 0.85**: на iPhone SE 4.7" текст всё равно может казаться большим vs iPhone 13. Это сознательная защита от мыла. Если папа жалуется именно на размер шрифта — это **не наша задача**, это Dynamic Type в iOS settings.
- **App Store обратная совместимость**: утилита не меняет API/контракты — нулевой риск для старых клиентов. Это чисто визуальное улучшение.

## Acceptance

- [ ] `src/utils/responsive.ts` создан, экспортирует `scale`, `verticalScale`, `moderateScale`, `ms`, `mvs`, `wp`, `hp`, `isSmallScreen`, `isShortScreen`, `screenSize`, `useResponsive`
- [ ] Юнит-тесты проходят (`npm test`)
- [ ] На iPhone SE simulator — Dashboard кнопки не налезают, sheets не упираются в нотч
- [ ] На iPhone 14 Pro simulator — дизайн **визуально идентичен** main (никакого скейлинга вверх / вниз)
- [ ] Type-check проходит (`npm run lint:types` если есть, иначе `tsc --noEmit`)
- [ ] `git diff` ограничен файлами из списка "Изменяемые" — без массового рефактора
