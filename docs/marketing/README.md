# Marketing Assets — App Store / Google Play

This folder is the source of truth for every visual / textual asset shipped to the stores.

## Files

| File | Purpose |
|---|---|
| [`../APP_STORE_LISTING.md`](../APP_STORE_LISTING.md) | App name, subtitle, full description, keywords, screenshot captions, "What's New" copy. |
| [`screenshots/01_hero_dashboard.png`](screenshots/01_hero_dashboard.png) | Hero — total spend + active subs ("Find Subscriptions in Seconds"). |
| [`screenshots/02_voice_input.png`](screenshots/02_voice_input.png) | AI voice input ("Say it. We add it."). |
| [`screenshots/03_screenshot_scan.png`](screenshots/03_screenshot_scan.png) | Receipt OCR ("Snap it. AI fills the form."). |
| [`screenshots/04_renewal_reminders.png`](screenshots/04_renewal_reminders.png) | Push reminders ("Never get blindsided again"). |
| [`screenshots/05_analytics.png`](screenshots/05_analytics.png) | Forecasts + categories ("See the patterns. Cut the waste."). |
| [`screenshots/06_team.png`](screenshots/06_team.png) | Workspace + duplicate detection ("Stop paying twice"). |
| [`screenshots/07_privacy.png`](screenshots/07_privacy.png) | Trust signals ("Your money stays yours"). |
| [`screenshots/08_savings_cta.png`](screenshots/08_savings_cta.png) | Closing CTA ("Save \$200+ a year"). |
| [`../../.maestro/99_marketing_screenshots.yaml`](../../.maestro/99_marketing_screenshots.yaml) | Maestro flow that captures the source UI on a real simulator. |

## Status of the screenshots

These are **AI-generated concept visuals** (gpt-image-1, 1024×1536 portrait, ~9:13 ratio) built from the actual feature set of the app. They mirror the layout of the competitor reference Daisy shared, including:

- Single-iPhone hero composition with the headline on top
- Bold serif headline + muted sans-serif subhead
- Distinct gradient per screen (mint, sky, lavender, sunset, indigo, mint-aqua, midnight, lime)
- Real subscription brand names in the mock UI (Netflix, Spotify, ChatGPT, iCloud) — matches what users actually have

### What to do before App Store upload

These work as-is for **social posts, landing pages, and as design references for Figma**, but for App Store Connect upload there are two paths:

1. **Treat them as final** and crop/clean to **1290×2796** (iPhone 17 Pro Max). They already match the right aspect ratio; minor typo cleanups in Figma (e.g. `$9:98` → `$9.99` in screenshot 03) are needed.
2. **Use them as composition templates.** Run `.maestro/99_marketing_screenshots.yaml` on a real iPhone 16 Pro Max simulator, drop the captured PNGs into Figma as the device-screen layer of these mockups, keep the headline/subhead/background.

Path 2 is the safer route for App Store review because Apple occasionally rejects "obviously fabricated" UI.

## Capturing real screenshots via Maestro

```bash
# 1. Boot the largest required device
xcrun simctl boot "iPhone 16 Pro Max"
open -a Simulator

# 2. Build & install (~10–15 min first time)
npm run start:dev                                     # one terminal
npx expo run:ios --device "iPhone 16 Pro Max" --configuration Release

# 3. Run the flow
maestro test .maestro/99_marketing_screenshots.yaml

# 4. Grab the PNGs
cp ~/.maestro/screenshots/99_marketing_*.png docs/marketing/screenshots/raw/
```

The flow uses the demo account `review@subradar.ai` with OTP `000000` — make sure that account has 4–8 realistic subscriptions seeded in dev DB before running, otherwise dashboard frames will look empty.

## Localization

Apple supports per-locale App Store metadata. v1 ships **English only** — the app itself is multilingual, but for App Store description one polished narrative beats five mediocre ones. Add Russian / Japanese / German localized listings after ~1000 downloads prove the English copy converts.
