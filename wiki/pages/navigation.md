---
title: "Карта навигации"
tags: [навигация, экраны, табы, модалы]
sources:
  - app/(tabs)/_layout.tsx
  - app/_layout.tsx
  - docs/NAVIGATION_MAP.md
updated: 2026-04-16
---

# Карта навигации

## Главные потоки

### Неавторизованный пользователь

```
Splash → Onboarding (слайды + регион + auth)
```

### Авторизованный, первый запуск

```
Onboarding Step 1..N → Region Selection → Auth → Main App
```

### Основное приложение

Bottom Tab Bar с 6 табами (включая виртуальную кнопку "Add"):

```
Home | Subscriptions | [+Add] | Analytics | Workspace | Settings
```

## Табы

| Таб | Файл | Иконка | Описание |
|-----|-------|--------|----------|
| Home | `(tabs)/index.tsx` | home | Dashboard: итоги, upcoming, тренды |
| Subscriptions | `(tabs)/subscriptions.tsx` | layers | Список подписок с фильтрами |
| Add | — | add (круглая кнопка) | Открывает AddSubscriptionSheet |
| Analytics | `(tabs)/analytics.tsx` | bar-chart | Аналитика, графики, AI анализ |
| Workspace | `(tabs)/workspace.tsx` | people | Team/Workspace |
| Settings | `(tabs)/settings.tsx` | settings | Настройки, профиль, биллинг |

### Кнопка "Add"

Центральная круглая кнопка в таббаре. Не является настоящим табом — открывает `AddSubscriptionSheet` (bottom sheet) через `useUIStore.openAddSheet()`.

Sheet предзагружается через `InteractionManager.runAfterInteractions()` + 500ms задержка для устранения задержки при первом открытии (~800+ строк, тяжёлый компонент).

## Overlay / модальные экраны

| Экран | Путь | Тип |
|-------|------|-----|
| Subscription Detail | `/subscription/[id]` | Modal (Stack) |
| Reports | `/reports/index` | Stack screen |
| Cards | `/cards` | Stack screen |
| Paywall | `/paywall` | Stack screen |
| Edit Profile | `/edit-profile` | Stack screen |
| Subscription Plan | `/subscription-plan` | Stack screen |

## Потоки добавления подписки

```
Кнопка [+] → AddSubscriptionSheet (3 опции):
  ├── Ручной ввод → Форма → Save → Detail
  ├── AI текст → AI Lookup → Review → Save → Detail
  ├── Голос → Запись → Processing → Review → Save → Detail
  └── Скриншот → Image Picker → Processing → Review → Save → Detail
```

## Диаграмма навигации

```
                    ┌──────────┐
                    │  Splash  │
                    └────┬─────┘
                         │
              ┌──────────┴──────────┐
              │ has valid token?     │
              └──┬──────────────┬───┘
                 │ No           │ Yes
                 v              v
           ┌─────────┐   ┌──────────────┐
           │Onboarding│   │ isOnboarded? │
           └────┬─────┘   └──┬───────┬───┘
                │            │ No    │ Yes
                v            v       v
           Auth →→→→→→→ Onboarding  Main App
                        (region+)   (tabs)
```

## Правила навигации

1. Новый экран = новый файл в `app/`
2. Переходы: `router.push()`, `router.replace()`, `router.back()`
3. Модалы через `presentation: 'modal'` в Stack options
4. Bottom sheet через `@gorhom/bottom-sheet` для действий

## Связанные страницы

- [[architecture]] — общая архитектура
- [[onboarding]] — поток онбординга
- [[ai-features]] — AI-методы добавления подписок
