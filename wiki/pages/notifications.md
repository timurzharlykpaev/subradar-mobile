---
title: "Уведомления"
tags: [уведомления, push, fcm, напоминания, email, digest, reminder-days]
sources:
  - app/_layout.tsx
  - src/utils/localNotifications.ts
  - src/api/notifications.ts
  - src/stores/settingsStore.ts
  - app/(tabs)/settings.tsx
  - CLAUDE.md
updated: 2026-05-22
---

# Уведомления

## Типы уведомлений

### 1. Push-уведомления (Expo Push Tokens)

Серверные push через Expo Push API (не Firebase Admin напрямую).

#### Регистрация при запуске

```typescript
// app/_layout.tsx → PushSetup
async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) return null;
  // Запрос разрешений
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;
  // Expo Push Token
  const expoPushToken = await Notifications.getExpoPushTokenAsync({
    projectId: 'b6fbf0f2-a22b-4eb7-8fb7-d03856c94551',
  });
  return expoPushToken.data;  // "ExponentPushToken[xxx]"
}
```

#### Отправка на бэкенд

```typescript
notificationsApi.registerPushToken(token, platform, locale?);
// POST /notifications/push-token
// locale — optional, чтобы backend cron мог отправлять push на правильном языке
// сразу после первой регистрации (не дожидаясь PATCH /users/me)
```

#### Обработка нотификаций

- **Foreground:** `addNotificationReceivedListener` (показывает alert/banner)
- **Tap на уведомление:** `addNotificationResponseReceivedListener`
  - Если есть `subscriptionId` → `router.push(/subscription/${subId})`

#### Notification Handler

```typescript
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

### 2. Локальные напоминания

Планируются при загрузке подписок:

```typescript
// app/_layout.tsx → DataLoader
if (notificationsEnabled) {
  schedulePaymentReminders(subs);
}
```

`schedulePaymentReminders()` из `src/utils/localNotifications.ts`:
- Cancel all existing scheduled notifications
- Для каждой ACTIVE/TRIAL подписки планирует уведомления за N дней до платежа
- Время триггера: 09:00 local

### Fix `32c2835` — honor global reminderDays

Раньше `schedulePaymentReminders` хардкодил `[1, 3]` как fallback когда у
подписки нет `reminderDaysBefore`. Settings → "Remind 3 days before" / "Off"
работали только для серверного push-cron'a — локальный планировщик
игнорировал глобальную настройку.

Сейчас читает `useSettingsStore.getState().reminderDays`:

| reminderDays | Sub имеет `reminderDaysBefore` | Behavior |
|--------------|-------------------------------|----------|
| `> 0` | Нет | schedule за N дней (где N = global) |
| `0` (Off) | Нет | skip scheduling — юзер выключил глобально |
| `0` или `> 0` | Да (массив) | per-sub array выигрывает |

Per-row preference всегда beats global default — это правильный приоритет.

### 3. Email уведомления

Настраиваются через API:

```typescript
notificationsApi.updateSettings({
  emailNotifications: boolean,  // Напоминания о платежах по email
});
```

### 4. Weekly AI Digest

Email-дайджест с AI-анализом, отправляется каждый понедельник.

```typescript
notificationsApi.updateSettings({
  weeklyDigestEnabled: boolean,  // Pro-only
});
```

**Pro gate:** для Free пользователей показывается иконка замка + переход на paywall.

## Настройки (Settings)

В `app/(tabs)/settings.tsx` секция "Notifications":

| Настройка | Тип | Pro-only |
|-----------|-----|----------|
| Push Notifications | Switch | Нет |
| Email Notifications | Switch | Нет |
| Weekly AI Digest | Switch | Да |
| Remind Before | Chips: Off, 1d, 3d, 7d | Нет |

### Синхронизация с бэкендом

```typescript
const syncNotifications = (enabled: boolean, days: number) => {
  notificationsApi.updateSettings({ enabled, daysBefore: days || 3 });
};
```

## Загрузка настроек

При монтировании Settings:

```typescript
useEffect(() => {
  notificationsApi.getSettings().then((res) => {
    setEmailNotifications(data.emailNotifications ?? true);
    setWeeklyDigest(data.weeklyDigestEnabled ?? true);
  });
}, []);
```

## Разрешения

- Push: `expo-notifications` → `Notifications.requestPermissionsAsync()`
- Запрашиваются при запуске приложения (PushSetup)
- Не работает на эмуляторе/Expo Go

## Push deep-link сценарии

| Источник push | Payload | Действие |
|--------------|---------|----------|
| Payment reminder | `subscriptionId` | `router.push(/subscription/${id})` |
| Gmail scan completed | `jobId` | `router.push(/gmail-import?jobId=…)` — auto-resume |
| Weekly digest preview | (нет) | open dashboard |

См. [[gmail-import]] для auto-resume через jobId deep-link.

## Связанные страницы

- [[architecture]] — PushSetup в дереве провайдеров
- [[billing]] — Weekly AI Digest доступен только Pro
- [[subscriptions]] — напоминания привязаны к nextPaymentDate
- [[gmail-import]] — push deep-link `?jobId=…`
- [[known-issues]] — fix `32c2835` про reminderDays
