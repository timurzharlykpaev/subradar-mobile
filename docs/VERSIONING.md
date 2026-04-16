# Versioning

SubRadar Mobile follows **Semantic Versioning** (`MAJOR.MINOR.PATCH`) for the user-facing version, with a separate **build number** for each store submission.

## Version number (`expo.version` in `app.json`)

| Bump | When | Example |
|------|------|---------|
| **PATCH** (1.2.3 → 1.2.4) | Bug fixes, copy tweaks, translation corrections, minor UI polish | Fix crash on paywall, correct Russian translation, adjust spacing |
| **MINOR** (1.2.3 → 1.3.0) | New feature, new screen, new API integration, behavioural change | Add voice AI input, add Team workspace, add Export CSV |
| **MAJOR** (1.2.3 → 2.0.0) | Breaking UX change, full redesign, migration that invalidates old data | Redesign navigation, migrate to new auth backend |

### How to bump

The following scripts update **both** `package.json` **and** `app.json` in a single step:

```bash
npm run version:patch   # 1.2.3 → 1.2.4
npm run version:minor   # 1.2.3 → 1.3.0
npm run version:major   # 1.2.3 → 2.0.0
```

Commit the bump on its own:

```bash
git add package.json app.json
git commit -m "chore: bump to 1.3.0"
```

### What the scripts do

Under the hood they run:
1. `npm version <type> --no-git-tag-version` — updates `package.json`.
2. A small Node one-liner that reads the new version from `package.json` and writes it to `app.json` at `expo.version`.

See `package.json` → `scripts.version:*`.

## Build number (`buildNumber` / `versionCode`)

- Each EAS build auto-increments the platform-specific build number (`ios.buildNumber`, `android.versionCode`) because every profile in `eas.json` has `autoIncrement: true`.
- We do **not** commit build numbers to the repo — EAS tracks them remotely (`cli.appVersionSource: "remote"`).
- App Store / Play Store require a strictly increasing build number per version. EAS handles this automatically.

### Version vs build number

| Scenario | version | buildNumber |
|----------|---------|-------------|
| First TestFlight submission | 1.3.0 | 1 |
| Bug-fix rebuild before ship | 1.3.0 | 2 |
| New feature, new TestFlight | 1.4.0 | 3 |
| App Store release | 1.4.0 | 3 |
| OTA update on top of 1.4.0 | 1.4.0 | 3 (unchanged) |

## Release flow

```bash
# 1. Finish your feature on main
git checkout main && git pull

# 2. Bump the version (choose type based on the change)
npm run version:minor    # if you added a new feature
# or npm run version:patch for a fix

# 3. Commit the bump
git add package.json app.json
git commit -m "chore: bump to $(node -p "require('./package.json').version")"
git push origin main

# 4. Trigger the build
npm run build:testflight          # ships to TestFlight
# or npm run build:production      # ships to App Store Review
```

## OTA updates (no version bump needed)

For JS-only patches:

```bash
eas update --branch production --message "fix: icon fallback on slow network"
```

Clients pick it up on next foreground. Do **not** bump the version for OTA-only changes — the version on the store stays the same, and OTA is tied to a particular version's runtime.

## When in doubt

- Added a new route / screen? → MINOR
- Changed something users will immediately notice (new button, new flow)? → MINOR
- Fixed a bug no one should have noticed? → PATCH
- Translated a few strings? → PATCH
- Replaced the entire navigation? → MAJOR

## Related

- [Build profiles](BUILD_PROFILES.md) — which EAS profile ships where
- [README](../README.md#deployment) — full deploy workflow
