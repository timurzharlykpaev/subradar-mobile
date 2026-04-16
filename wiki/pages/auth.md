---
title: "Аутентификация"
tags: [авторизация, google, apple, magic-link, токены]
sources:
  - src/hooks/useAuth.ts
  - src/stores/authStore.ts
  - src/api/auth.ts
  - app/onboarding.tsx
  - CLAUDE.md
updated: 2026-04-16
---

# Аутентификация

## Методы авторизации

### 1. Google OAuth

**Мобильные endpoints:**
- `POST /auth/google/mobile { idToken }` — нативный Google Sign-In
- `POST /auth/google/token { accessToken }` — через access token

**Client IDs:**
- Web: `1026598677430-a59lmlfdo7r0ug1f6lafl52aean648i9.apps.googleusercontent.com`
- iOS: `1026598677430-8qjldmtstvjo9a9gjsabipo05mo7ci5u.apps.googleusercontent.com`

### 2. Apple Sign-In

- `POST /auth/apple`
- Только iOS (`expo-apple-authentication`)
- Динамически подгружается: `if (Platform.OS === 'ios') require('expo-apple-authentication')`

### 3. Magic Link

Двухшаговый процесс:

1. **Отправка ссылки:** `POST /auth/magic-link { email }` → письмо на email
2. **Верификация:** `POST /auth/verify { token }` → `{ user, token }`

**Важно:** мобильная верификация использует POST (не GET как в вебе).

## authStore (Zustand)

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  _hasHydrated: boolean;

  setUser(user, token, refreshToken?): void;
  setTokens(token, refreshToken): void;
  updateUser(data: Partial<User>): void;
  logout(): void;
  setOnboarded(): void;
}
```

### Хранение токенов

Токены хранятся в **expo-secure-store** (нативный Keychain/Keystore), не в AsyncStorage:

```typescript
const secureStorage = {
  getItem: (name) => SecureStore.getItemAsync(name),
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  removeItem: (name) => SecureStore.deleteItemAsync(name),
};
```

Ключ: `auth-storage`.

**Partialize:** персистятся только `user`, `token`, `refreshToken`, `isAuthenticated`, `isOnboarded`.

### Logout

При logout:
1. Очищаются `trial_offered` и `welcome_shown` из AsyncStorage
2. Сбрасываются user, token, refreshToken, isAuthenticated
3. RevenueCat logout (`logoutRevenueCat()`)

## useAuth хук

```typescript
function useAuth() {
  return {
    user,
    token,
    isAuthenticated,
    isOnboarded,
    sendMagicLink(email),    // Отправить magic link
    verifyMagicLink(token),  // Верифицировать + сохранить user/token
    signOut(),               // Logout
    setOnboarded(),          // Пометить онбординг завершённым
  };
}
```

## Поток авторизации

```
Onboarding экран
  ├── Google Sign-In → POST /auth/google/mobile → setUser()
  ├── Apple Sign-In  → POST /auth/apple → setUser()
  └── Magic Link
      ├── Ввод email → POST /auth/magic-link
      └── Ввод кода  → POST /auth/verify → setUser()
→ setOnboarded() → router.replace('/(tabs)')
```

## Refresh Token

`authStore.setTokens(token, refreshToken)` — обновляет оба токена. Используется axios interceptor для автоматического refresh при 401.

## User Entity

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  defaultCurrency?: string;
  locale?: string;
  timezone?: string;
  region?: string;
  displayCurrency?: string;
  onboardingCompleted?: boolean;
  notificationsEnabled?: boolean;
}
```

## КРИТИЧНОЕ ПРАВИЛО

> Не ломать существующий Google/Apple auth. Это агентское правило #1.

## Связанные страницы

- [[onboarding]] — поток онбординга включает авторизацию
- [[state-management]] — authStore
- [[notifications]] — FCM токен отправляется после авторизации
