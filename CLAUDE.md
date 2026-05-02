# SubRadar Mobile — Claude Code Guide

## Язык
**Всегда отвечай на русском языке.**

## Проект
SubRadar AI — мобильное приложение для отслеживания подписок с AI-возможностями.

**Стек:** React Native + Expo SDK 51, TypeScript (strict), Expo Router (file-based routing), TanStack Query v5, Zustand, Axios, react-native-reanimated, @gorhom/bottom-sheet, expo-notifications (FCM), expo-image-picker, expo-av (voice).

**Платформы:** iOS + Android

## Структура
```
app/                         # Expo Router (файловая маршрутизация)
├── _layout.tsx              # Корневой layout (провайдеры)
├── index.tsx                # Стартовый экран / редирект
├── onboarding.tsx           # Экран онбординга
├── (tabs)/                  # Tab navigator
│   ├── _layout.tsx
│   ├── index.tsx            # Dashboard
│   ├── subscriptions.tsx    # Список подписок
│   ├── analytics.tsx        # Аналитика
│   └── settings.tsx         # Настройки
├── cards/                   # Управление картами
├── reports/                 # Отчёты
└── subscription/            # Детальная страница подписки

src/
├── api/         # Axios инстанс + API функции
├── components/  # UI компоненты
├── constants/   # Цвета, размеры, строки
├── hooks/       # TanStack Query хуки
│   ├── useAI.ts
│   ├── useAnalytics.ts
│   ├── useAuth.ts
│   ├── useBilling.ts
│   └── useSubscriptions.ts
├── stores/      # Zustand сторы
├── types/       # TypeScript типы
└── utils/       # Утилиты
```

## Критичные правила

### 🚨 App Store — обратная совместимость API (КРИТИЧНО)

Мобильное приложение **уже выпущено в App Store** и у пользователей установлены **старые версии**. Адопшен новой версии в App Store идёт постепенно (≈50% за неделю, 90% за 4 недели), и старые билды продолжают ходить на тот же `api.subradar.ai` прод.

**Любое изменение бэкенда или мобилки должно быть продумано с учётом старых клиентов:**

1. **По умолчанию — additive changes.** Новое поведение → новое поле, новый эндпоинт (`/v2/...`), новый query-параметр. **Не модифицируй ответ существующего эндпоинта**, на который полагаются старые клиенты.
2. **Новые request-поля делай optional с дефолтами**, совпадающими со старым поведением. Старый клиент не шлёт поле → получает старую семантику.
3. **Никогда не удаляй и не переименовывай поля**, которые читают старые клиенты. Даже если поле legacy/wrong — оставь его, заполняй best-effort, добавляй новое рядом.
4. **Server-side gating > client-side gating.** Новые лимиты/планы/правила реализуй на сервере, чтобы старые клиенты автоматически получили исправление без обновления.
5. **Никогда не ужесточай DTO-валидацию задним числом** (новое required поле, более строгий regex). Старые клиенты шлют ту же payload и начинают получать 400. Сначала loosen, потом tighten после адопшена.
6. **Не удаляй значения enum**, на которых клиент свитчится (например `SubscriptionStatus`). Только добавляй новые. Удаление = краш на старых билдах.
7. **Если изменение нельзя сделать обратно-совместимым — предупреди пользователя ЯВНО**, прежде чем коммитить. Формулировка: *"Это сломает X на версиях ≤ A.B.C — продолжать?"*. Не просачивай молча.
8. **Bump версии в `app.json` не помогает старым пользователям** — он влияет только на новые билды. Не полагайся на bump чтобы «починить» обратную несовместимость.

**Force-update / kill-switch escape:** если изменение действительно нельзя сделать backward-compat (например критичный security fix), правильный паттерн — серверный «minimum supported version» эндпоинт + UI который заставляет старых юзеров обновиться. Не использовать casually.

### API — мобильные алиасы
Мобильное приложение использует специфические эндпоинты:
- **Google**: `POST /auth/google/mobile { idToken }` или `POST /auth/google/token { accessToken }`
- **Apple**: `POST /auth/apple`
- **Magic link верификация**: `POST /auth/verify { token }` (не GET)
- **Голосовой ввод**: `POST /ai/voice-to-subscription` (multipart с `file`) или `POST /ai/voice { audioBase64 }`
- **Чеки**: можно использовать `POST /subscriptions/:id/receipts` или `POST /receipts`
- **Профиль**: `PATCH /users/me` (так же как в вебе — **не** `/auth/me`)

### Навигация
- **Expo Router** — file-based routing. Новый экран = новый файл в `app/`.
- Переходы: `router.push('/(tabs)/subscriptions')`.
- Modal: `router.push('/subscription/add')` или bottom sheet.

### Permissions
- Камера/галерея — `expo-image-picker` (запрашивать разрешения перед использованием)
- Микрофон — `expo-av` (запрашивать разрешения)
- Push-уведомления — `expo-notifications` (запрашивать разрешения)

### UI/UX правила
- `SafeAreaView` из `react-native-safe-area-context` на всех экранах.
- Статус бар — `expo-status-bar`.
- Нижний таббар + safe area.
- Поддержка `KeyboardAvoidingView` для форм.
- Bottom sheet через `@gorhom/bottom-sheet` для модальных действий.

### Тема (КРИТИЧНО)
- Все цвета ТОЛЬКО через `useTheme()` → `colors.xxx` (inline стили).
- **ЗАПРЕЩЕНО** использовать `COLORS.xxx` из constants в StyleSheet.create — это статичные dark-only значения.
- **ЗАПРЕЩЕНО** `isDark ? '#hex1' : '#hex2'` — вместо этого использовать `colors.surface`, `colors.card` и т.д.
- StyleSheet.create должен содержать ТОЛЬКО layout (flex, padding, margin, borderRadius, fontSize, fontWeight, gap).
- Допустимые хардкод цвета: `#FFF` на кнопках с primary bg, rgba для теней/overlay.

### Стейт
- **Zustand** — authStore (токены в AsyncStorage), appStore (тема, валюта, язык).
- **TanStack Query** — все серверные данные.
- AsyncStorage ключи: `auth_token`, `refresh_token`.

### Нотификации (FCM)
При запуске приложения:
1. Запросить разрешение на push-уведомления
2. Получить FCM токен через `expo-notifications`
3. Отправить `PATCH /users/me { fcmToken }` на бэкенд

## AI фичи (ключевое отличие от веба)

### Голосовой ввод
```
expo-av → запись аудио → audioBase64/file
→ POST /ai/voice-to-subscription
→ { name, amount, currency, billingCycle, ... }
```

### Скриншот / галерея
```
expo-image-picker → imageBase64/file
→ POST /ai/parse-screenshot
→ { name, amount, currency, billingPeriod, date, planName }
```

### Умный поиск
```
Текстовый ввод → POST /ai/lookup { query, locale, country }
→ { name, logoUrl, category, plans[] }
```

## Команды
```bash
# Дев-сервер
npm run start:dev           # Dev API + Metro
npm run start:prod          # Prod API + Metro

# Билды
npm run build:testflight    # TestFlight (test RC key, prod API)
npm run build:production    # App Store (prod RC key, prod API)
npm run build:preview       # Internal distribution (ad-hoc)
npm run build:android       # Android production

# Тесты
npm test                    # Jest unit tests
npm run test:e2e            # Maestro E2E (все тесты)
```

## Версионирование (Semantic Versioning)

Формат: `MAJOR.MINOR.PATCH` (например `1.2.3`)

| Тип | Когда | Команда | Пример |
|-----|-------|---------|--------|
| **PATCH** (1.0.0 → 1.0.1) | Баг-фиксы, мелкие правки UI, исправления переводов | `npm run version:patch` | Фикс краша, исправление отображения |
| **MINOR** (1.0.0 → 1.1.0) | Новая фича, новый экран, новый API endpoint | `npm run version:minor` | AI голосовой ввод, отчёты, workspace |
| **MAJOR** (1.0.0 → 2.0.0) | Breaking changes, полный редизайн, смена архитектуры | `npm run version:major` | Переход на новый бэкенд, редизайн |

**Правила:**
- `version:*` скрипты обновляют **и** `package.json` **и** `app.json` одновременно
- `buildNumber` (iOS) / `versionCode` (Android) инкрементируются автоматически EAS (`autoIncrement: true`)
- **Перед каждым билдом в TestFlight/App Store** — поднять версию если были изменения
- Коммит версии отдельно: `git commit -m "chore: bump version to X.Y.Z"`

**Workflow:**
```bash
# Баг-фикс → patch
npm run version:patch && git add -A && git commit -m "chore: bump 1.0.1" && npm run build:testflight

# Новая фича → minor
npm run version:minor && git add -A && git commit -m "chore: bump 1.1.0" && npm run build:testflight

# Мажорный релиз → major
npm run version:major && git add -A && git commit -m "chore: bump 2.0.0" && npm run build:production
```

## EAS Build профили

| Профиль | RC Key | API | Куда |
|---------|--------|-----|------|
| `testflight` | `appl_...` (prod RC) | prod | TestFlight |
| `production` | `appl_...` (real IAP) | prod | App Store |
| `preview` | `test_...` | dev | Internal (ad-hoc) |
| `development` | `test_...` | dev | Dev client |

## RevenueCat

- **Test key (sandbox):** `test_KCkKkTcGjgMgysTZtGukFRBZBBh`
- **Prod key (App Store):** `appl_IDgkDELtmOrLlMVaOpCcPemoqyH`
- **REST API ID:** `app19263dc738`
- Entitlements: `pro`, `team`
- Products: `io.subradar.mobile.pro.monthly`, `io.subradar.mobile.pro.yearly`, `io.subradar.mobile.team.monthly`, `io.subradar.mobile.team.yearly`

## Переменные окружения

```env
EXPO_PUBLIC_API_URL=https://api.subradar.ai/api/v1
EXPO_PUBLIC_REVENUECAT_KEY=test_KCkKkTcGjgMgysTZtGukFRBZBBh      # dev/testflight
EXPO_PUBLIC_REVENUECAT_KEY_IOS=appl_IDgkDELtmOrLlMVaOpCcPemoqyH  # production only
```

## Деплой

```bash
# TestFlight (для тестирования)
npm run build:testflight

# App Store (релиз)
npm run build:production

# Android
npm run build:android

# OTA Updates (hotfix без стора)
eas update --branch production --message "fix: description"
```

## Хуки — ответственности

| Хук | Назначение |
|-----|-----------|
| `useAuth` | Авторизация (Google, Apple, magic link), refresh, /auth/me |
| `useSubscriptions` | CRUD подписок, cancel, pause, restore |
| `useAnalytics` | summary, monthly, by-category, by-card, upcoming |
| `useBilling` | Pro подписка (plans, checkout, me, cancel) |
| `useAI` | lookup, parse-screenshot, voice-to-subscription |

## Онбординг

Экран `app/onboarding.tsx` — показывается при первом запуске (если нет `auth_token`).

Слайды используют картинки из `/public/onboarding/`:
- `onboarding-1-radar.png` — главный экран
- `onboarding-2-ai.png` — AI фичи
- `onboarding-3-analytics.png` — аналитика
- `onboarding-4-reminders.png` — напоминания

## Документация

Подробная спецификация продукта в папке `docs/`:
- `docs/PRODUCT_OVERVIEW.md` — обзор продукта, принципы, аудитория, монетизация, MVP критерии
- `docs/DOMAIN_MODEL.md` — все сущности и их поля, lifecycle статусов
- `docs/API_CONTRACTS.md` — все API endpoints (с mobile-specific аннотациями)
- `docs/BILLING_RULES.md` — тарифы Free/Pro/Team, логика триала
- `docs/AI_BEHAVIOR.md` — правила поведения AI, confidence levels, fallback
- `docs/STATE_RULES.md` — жизненный цикл подписки, empty states
- `docs/MOBILE_SCREENS.md` — screen-by-screen PRD с UI блоками, состояниями, событиями
- `docs/NAVIGATION_MAP.md` — карта навигации (flows, tabs, overlays)

## Agent Rules
1. Не ломать существующий Google/Apple auth
2. Не добавлять новые библиотеки без явной причины
3. Любая AI-фича должна иметь fallback UI
4. Любой новый экран должен быть связан с navigation map (docs/NAVIGATION_MAP.md)
5. Любой новый API endpoint должен быть отражён в docs/API_CONTRACTS.md
6. Любая тяжёлая операция должна быть async
7. Любые финансовые данные требуют user confirmation
8. Любая новая сущность должна иметь status lifecycle
9. Любая продуктовая фича должна иметь analytics events
10. Не реализовывать Release 2/3 фичи, пока не стабилен MVP (Release 1)

## Смежные репозитории

| Репо | Описание |
|------|---------|
| `subradar-backend` | NestJS API |
| `subradar-web` | React веб-приложение |
| `subradar-landing` | Лендинг subradar.ai |

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
