# EAS Build Profiles

This document describes each build profile defined in `eas.json` — what it targets, which API it hits, which RevenueCat key it uses, and when to run it.

See [eas.json](../eas.json) for the source of truth.

## Summary

| Profile | Distribution | API | RevenueCat | Android output | Destination |
|---------|-------------|-----|------------|----------------|-------------|
| `development` | Internal (your device) | `api-dev` | test (sandbox) | — | Dev client on your phone |
| `preview` | Internal | `api-dev` | test (sandbox) | APK | Ad-hoc testers, TestFlight Internal |
| `preview-prod` | Internal | `api` (**prod**) | test (sandbox) | — | Testing prod API with sandbox IAP |
| `testflight` | Store | `api` (prod) | prod | AAB | TestFlight (internal + external) |
| `production` | Store | `api` (prod) | prod | AAB | App Store / Play Store production |

## Details

### `development`

For running a **development client** on your own device (Metro connected, hot reload, debugger).

- **API:** `api-dev.subradar.ai` (dev data, safe to experiment)
- **RevenueCat:** test key — purchases are sandboxed, no real money
- **Distribution:** `internal` — ad-hoc provisioning
- **When to use:** day-to-day feature development

```bash
eas build --platform ios --profile development
```

After the build, install the `.ipa` via Xcode or Apple Configurator. Then run:

```bash
npm run start:dev
```

### `preview`

Internal builds for **testers** — distributed via TestFlight Internal (iOS) or Play Console Internal Testing (Android, APK).

- **API:** `api-dev.subradar.ai`
- **RevenueCat:** test key
- **Distribution:** `internal`
- **Android:** AAB (app-bundle) — Play Console Internal Testing
- **iOS:** `.ipa` — TestFlight Internal group, no external review needed
- **Auto-increment:** yes
- **When to use:** share builds with QA / founders before any prod submission

```bash
eas build --platform all --profile preview
```

### `preview-prod`

Like `preview`, but points at the **production API**. Use this to reproduce a production-only bug while still keeping sandbox IAP so you don't charge your card.

- **API:** `api.subradar.ai` (prod data — read carefully)
- **RevenueCat:** test key (sandbox)
- **Distribution:** `internal`, iOS only (`autoIncrement: true`)
- **When to use:** debugging a prod-only issue, verifying a prod-safe change

```bash
eas build --platform ios --profile preview-prod
```

Be careful — any API calls you make hit real user data.

### `testflight`

Builds that go to **TestFlight** (iOS internal + external testers). Uses production API and production RevenueCat key — testers see real subscription SKUs, but can opt out via TestFlight sandbox promo codes.

- **API:** `api.subradar.ai`
- **RevenueCat:** prod key (`appl_...`)
- **Distribution:** `store`
- **Auto-submit:** yes (`--auto-submit` in the script)
- **Node:** 22.0.0, cached build
- **When to use:** final pre-release validation; this is the build you promote to App Store when ready

```bash
npm run build:testflight
# → git checkout main && git pull && eas build --platform ios --profile testflight --auto-submit
```

### `production`

Builds that ship to **App Store Review / Play Store Production**.

- **API:** `api.subradar.ai`
- **RevenueCat:** prod key
- **Distribution:** `store`
- **Auto-submit:** yes
- **When to use:** the final release build

```bash
npm run build:production
```

After EAS finishes and submits, promote the build in App Store Connect when you're ready to go live. We typically wait 24–48 h of TestFlight soak time before submitting for review.

## Choosing a profile

Flowchart:

```
Is this for a tester other than me?
├── No  → development
└── Yes
    ├── Do I need prod data?
    │   ├── No  → preview
    │   └── Yes → preview-prod
    └── Is this a release candidate?
        ├── Internal test only → testflight
        └── Going to the store → production
```

## RevenueCat sandbox vs prod

Any build with `EXPO_PUBLIC_REVENUECAT_KEY` starting with `test_` talks to the RevenueCat sandbox. Any build with `appl_` talks to RevenueCat prod, which uses StoreKit's sandbox environment when the Apple ID is a tester, and the real store otherwise.

Do **not** mix `testflight` / `production` with the test key — real users would see purchases go nowhere.

## Environment variables per profile

See `eas.json` → `build.<profile>.env`. Each profile injects:

- `EXPO_PUBLIC_API_URL` — which backend to hit
- `EXPO_PUBLIC_REVENUECAT_KEY` — IAP SDK key
- `EXPO_PUBLIC_REVENUECAT_KEY_IOS` — iOS-specific override (prod only)
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` — Google OAuth
- `EXPO_PUBLIC_SENTRY_DSN` — error reporting (testflight / production)
- `EXPO_PUBLIC_ENV` — tag used in Sentry / analytics

## Troubleshooting

- **Build fails with "missing credentials":** run `eas credentials` and re-sync the distribution certificate / provisioning profile.
- **Build succeeds but crashes on launch:** check `EXPO_PUBLIC_API_URL` — mismatched env between profile and runtime is the most common cause.
- **Purchases don't restore:** confirm the RevenueCat key matches the environment; test key + prod API = broken restore.

## Related

- [eas.json](../eas.json) — canonical config
- [Versioning](VERSIONING.md) — when to bump version before building
- [README](../README.md) — full deploy workflow
