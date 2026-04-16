---
title: "Архитектура"
tags: [архитектура, маршрутизация, стейт, провайдеры]
sources:
  - app/_layout.tsx
  - app/(tabs)/_layout.tsx
  - CLAUDE.md
updated: 2026-04-16
---

# Архитектура

## Файловая структура

```
app/                         # Expo Router (файловая маршрутизация)
├── _layout.tsx              # Корневой layout (провайдеры)
├── index.tsx                # Стартовый экран / редирект
├── onboarding.tsx           # Экран онбординга
├── (tabs)/                  # Tab navigator
│   ├── _layout.tsx          # Конфигурация табов + AddSubscriptionSheet
│   ├── index.tsx            # Dashboard
│   ├── subscriptions.tsx    # Список подписок
│   ├── analytics.tsx        # Аналитика
│   ├── workspace.tsx        # Команда (Team)
│   └── settings.tsx         # Настройки
├── cards/                   # Управление картами
├── reports/                 # Отчёты
└── subscription/            # Детальная страница подписки

src/
├── api/         # Axios инстанс + API функции
├── components/  # UI компоненты
├── constants/   # Цвета, категории, строки, таймзоны
├── hooks/       # TanStack Query хуки
├── i18n/        # i18next конфигурация и переводы
├── services/    # Аналитика, CSV экспорт
├── stores/      # Zustand сторы
├── theme/       # Тема (dark/light)
├── types/       # TypeScript типы
└── utils/       # Утилиты (formatMoney, localNotifications, etc.)
```

## Дерево провайдеров

Корневой `app/_layout.tsx` оборачивает всё приложение:

```
GestureHandlerRootView
  └── ErrorBoundary
      └── ThemeProvider
          └── I18nextProvider
              └── QueryClientProvider
                  ├── AdaptiveStatusBar
                  ├── OfflineBanner
                  ├── LanguageLoader       (sync i18n с settingsStore)
                  ├── DataLoader           (загрузка данных при авторизации)
                  ├── PushSetup            (регистрация push-токена)
                  └── Stack (Expo Router)
```

## Паттерны

### Маршрутизация

**Expo Router** — file-based routing. Каждый файл в `app/` = маршрут.

- Переходы: `router.push('/(tabs)/subscriptions')`
- Модалы: `<Stack.Screen options={{ presentation: 'modal' }}>`
- Bottom sheet: `AddSubscriptionSheet` монтируется в `(tabs)/_layout.tsx` — предзагрузка через `InteractionManager` для устранения задержки

### Стейт-менеджмент

Двойная модель — см. [[state-management]]:

- **Zustand** — локальный стейт (авторизация, настройки, UI)
- **TanStack Query** — серверные данные (подписки, аналитика, биллинг)

### Тема

Все цвета через `useTheme()` — см. [[theme]].

### Загрузка данных

Компонент `DataLoader` при авторизации:
1. Автодетект региона из таймзоны (если defaults)
2. Конфигурация RevenueCat
3. Идентификация пользователя в аналитике
4. Загрузка карт и подписок
5. Планирование локальных напоминаний

### QueryClient

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,        // 30 секунд
      retry: (failureCount, error) => {
        // Не ретраить 4xx — клиентские ошибки
        if (status >= 400 && status < 500) return false;
        return failureCount < 1;  // 1 ретрай для 5xx/network
      },
    },
  },
});
```

## Связанные страницы

- [[navigation]] — карта навигации
- [[state-management]] — Zustand и TanStack Query
- [[theme]] — тема и цвета
