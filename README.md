# SubRadar Mobile

Subscription tracker with AI. Built with Expo + React Native.

**Bundle ID:** `io.subradar.mobile`  
**EAS Project:** `@timur98_zkharlyk/subradar`  
**Apple Team:** `KH4TZU35XL` (GOALIN, TOO)

---

## Environments

| Environment | API | Subscriptions | Build Profile |
|-------------|-----|---------------|---------------|
| Dev | `api-dev.subradar.ai` | Sandbox (test) | `preview` |
| Prod | `api.subradar.ai` | Real payments | `production` |

---

## Local Development on Physical Device

### DEV (→ api-dev.subradar.ai)

```bash
# 1. Set env
echo "EXPO_PUBLIC_API_URL=https://api-dev.subradar.ai/api/v1" > .env

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Start Metro
npm run start:dev
```

> ⚠️ Expo Go не работает (reanimated v3). Нужен development build на телефоне.

First time — install development build on device:
```bash
eas build --platform ios --profile development
# После сборки установи .ipa через Xcode или Apple Configurator
```

### PROD (→ api.subradar.ai)

```bash
echo "EXPO_PUBLIC_API_URL=https://api.subradar.ai/api/v1" > .env
npm run start:prod
```

### Quick Switch Scripts

```bash
npm run start:dev    # DEV server
npm run start:prod   # PROD server
```

---

## CI/CD — Automatic Builds

### Dev builds (push to `dev` branch)

```bash
git push origin dev
```

Automatically triggers:
- 🍎 **iOS** → EAS Build (preview) → **TestFlight Internal Testing**
- 🤖 **Android** → EAS Build (preview APK) → **Play Internal Testing**

Both builds point to `api-dev.subradar.ai` with sandbox subscriptions.

### Prod builds (manual trigger)

GitHub → Actions → **"Build Prod"** → Run workflow → choose platform

Or via CLI:
```bash
# Build
eas build --platform all --profile production

# Submit to stores
eas submit --platform ios --profile production --latest
eas submit --platform android --profile production --latest
```

Prod builds point to `api.subradar.ai` with real payments.

---

## EAS Build Profiles

| Profile | Distribution | API | Android output |
|---------|-------------|-----|----------------|
| `development` | Internal (your device only) | api-dev | — |
| `preview` | Internal (testers) | api-dev | APK |
| `production` | Store | api-prod | AAB |

```bash
# Dev build (your device)
eas build --platform ios --profile development

# Preview build (testers)
eas build --platform ios --profile preview
eas build --platform android --profile preview

# Production build (store release)
eas build --platform all --profile production
```

---

## Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | EAS access token from expo.dev |
| `APPLE_APP_SPECIFIC_PASSWORD` | From appleid.apple.com |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Play Console service account JSON |

---

## Tech Stack

- Expo SDK 54
- React Native
- TypeScript
- Zustand (persisted with AsyncStorage)
- React Query
- expo-router
- react-native-svg
- expo-notifications (local + push)

---

## Project Structure

```
app/
  (tabs)/         # Main tab screens
  onboarding.tsx  # Auth + onboarding flow
  subscription/   # Subscription detail
src/
  api/            # API clients
  stores/         # Zustand stores (persisted)
  components/     # Shared components
  utils/          # Helpers (localNotifications, errorReporter...)
  i18n/           # Translations (9 languages)
assets/
  images/         # Icons, splash screen
```

---

## Demo Account (for reviewers)

| Field | Value |
|-------|-------|
| Email | `reviewer@subradar.ai` |
| OTP Code | `123456` |
| Plan | Pro (full access) |
