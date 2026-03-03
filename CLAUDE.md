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
npx expo start          # Дев-сервер (QR-код для телефона)
npx expo start --ios    # iOS симулятор
npx expo start --android # Android эмулятор
npx expo build          # EAS Build
npx expo publish        # OTA обновление (Expo Updates)
```

## Переменные окружения

```env
EXPO_PUBLIC_API_URL=https://api.subradar.ai/api/v1
EXPO_PUBLIC_GOOGLE_CLIENT_ID=<id>
```

Для dev:
```env
EXPO_PUBLIC_API_URL=http://46.101.197.19:3101/api/v1
```

## Деплой

- **iOS**: App Store Connect (EAS Build → eas build --platform ios)
- **Android**: Google Play (EAS Build → eas build --platform android)
- **OTA Updates**: Expo EAS Update для hotfix без публикации в стор

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

## ТЗ

Полное техническое задание: `TZ.md` в корне репозитория.

## Смежные репозитории

| Репо | Описание |
|------|---------|
| `subradar-backend` | NestJS API |
| `subradar-web` | React веб-приложение |
| `subradar-landing` | Лендинг subradar.io |
