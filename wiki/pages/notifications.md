---
title: "Уведомления"
tags: [уведомления, push, fcm, напоминания, email, digest]
sources:
  - app/_layout.tsx
  - src/utils/localNotifications.ts
  - src/api/notifications.ts
  - app/(tabs)/settings.tsx
  - CLAUDE.md
updated: 2026-04-16
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
notificationsApi.registerPushToken(token, platform);
// → API endpoint для регистрации токена
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
- Планирует уведомления за N дней до платежа
- N настраивается пользователем: 0 (off), 1, 3, 7 дней

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

## Связанные страницы

- [[architecture]] — PushSetup в дереве провайдеров
- [[billing]] — Weekly AI Digest доступен только Pro
- [[subscriptions]] — напоминания привязаны к nextPaymentDate
