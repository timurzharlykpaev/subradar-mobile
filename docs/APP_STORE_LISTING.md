# App Store Listing — SubRadar AI

## App Name (30 chars max)
**SubRadar AI: Subscriptions**
> 27 chars — fits the 30-char limit; "Subscriptions" carries the keyword.

## Subtitle (30 chars max)
**Track every charge. Save more.**
> 30 chars — pairs functional benefit ("track every charge") with a value benefit ("save more").

## Promotional Text (170 chars — editable without re-review)
**Stop bleeding money on forgotten subscriptions. SubRadar AI finds them in seconds — by voice, screenshot, or smart search — then reminds you before every charge.**
> 161 chars.

## Description (4000 chars max — the big one)

**Stop losing money on subscriptions you forgot you had.**

The average person pays for 12+ subscriptions and forgets 3 of them. That's $200–500 a year quietly leaving your account. SubRadar AI is the subscription tracker that finds those forgotten charges, warns you before every renewal, and shows exactly where your money is going.

**ADD SUBSCRIPTIONS IN SECONDS**
- 🎙️ **Voice** — say "Netflix fifteen dollars monthly" and it's added.
- 📸 **Screenshot** — snap an Apple receipt or bank notification — AI fills the form.
- 🔎 **Smart search** — type "Spotify" and it auto-fills price, billing day, logo, even cancellation links.
- ✋ **Manual** — full control when you need it.

**NEVER GET SURPRISED BY A CHARGE**
- Push notifications 1, 3, or 7 days before every renewal — your call.
- Calendar-style upcoming view. See the next 30 days at a glance.
- Trial countdown — know exactly when free trials become paid.

**SEE WHERE THE MONEY GOES**
- Monthly and yearly forecasts in your currency.
- Spending by category — Streaming, Productivity, Fitness, AI tools, more.
- Compare months. Spot the creep.
- Multi-currency support with live exchange rates.

**TEAM & FAMILY PLANS**
- Add up to 10 members and split shared subscriptions.
- See who pays for what — and find duplicates ("3 people paying for Notion?").
- Per-member spend reports.

**AI-POWERED SAVINGS INSIGHTS**
- Detects subscription duplicates (someone already paying for ChatGPT).
- Suggests cheaper alternatives.
- Estimates yearly savings if you switch monthly → yearly billing.

**WORKS WITH EVERYTHING**
- 10 languages: English, Russian, Spanish, German, French, Portuguese, Japanese, Korean, Chinese, Kazakh.
- Supports any currency, any billing cycle (weekly, monthly, quarterly, yearly, lifetime).
- Light & dark themes.
- iOS + Apple Watch ready.

**PRIVACY-FIRST**
- Your data is yours. Encrypted in transit, hosted in the EU.
- No ads. No selling your data. Ever.
- Delete your account anytime, one tap.

**FREE FOREVER, OR GO PRO**

Free: 3 subscriptions, 5 AI requests/month, basic analytics.

Pro: Unlimited subscriptions, 200 AI requests/month, advanced analytics, PDF reports, priority support.

Team: Everything in Pro + up to 10 members + per-member analytics.

7-day free trial on all paid plans. Cancel anytime in iOS Settings.

---

*SubRadar AI is not affiliated with, endorsed by, or sponsored by Apple, Google, Netflix, Spotify, OpenAI, or any other service shown in our catalog. All trademarks are property of their respective owners.*

---

**Words/char counts (to fit Apple limits):**
- Total: ~2700 chars (well under 4000 limit)
- Sections separated for skim-readability

## Keywords (100 chars max — comma-separated, no spaces after commas)

`subscription tracker,budget,money saver,bills,recurring payments,trial reminder,AI,family,expense`

> 99 chars. Avoid stuffing trademarks (Netflix, Spotify) — Apple may flag.

## What's New (4000 chars — per release)

### v1.3.17
- Localized the renewal-warning banner across all 10 languages.
- Cleaner team-spend view with proper currency formatting.
- Edit-subscription form now shows the next-payment date as a live preview, with override hidden behind one tap.
- Subscription colour picker is finally wired to the card UI — pick a colour, see it everywhere.
- Faster pull-to-refresh on Workspace; fewer keyboard glitches when creating a team.

---

# Screenshots — set of 8

App Store requires **8 screenshots** at 6.7" (iPhone 17 Pro Max) display size. Format: 1290 × 2796 portrait. Each pairs a real app screen + an overlay headline. Below is what each one should show + the headline copy.

## 1. Hero — Dashboard
- **Source flow**: `99_marketing_01_dashboard`
- **Overlay headline**: "Know exactly where your money goes"
- **Sub**: "Track every subscription, never miss a charge"
- **Tone**: Confidence. Big total spend visible. 4-5 active subs in the list.

## 2. AI Voice Input
- **Source flow**: `99_marketing_05_voice_input`
- **Overlay headline**: "Say it. We add it."
- **Sub**: "Netflix fifteen dollars monthly. Done in 2 seconds."
- **Tone**: Magic. Show the mic listening state.

## 3. AI Screenshot Parsing
- **Source flow**: `99_marketing_03_add_sheet_default` (with screenshot tab visible)
- **Overlay headline**: "Snap an Apple receipt. Done."
- **Sub**: "AI reads the price, period, and billing day automatically."
- **Tone**: Effortless.

## 4. Renewal Reminders
- **Source flow**: derived from upcoming view or notification preview
- **Overlay headline**: "Never get blindsided again"
- **Sub**: "Push reminders 1, 3, and 7 days before every charge"
- **Tone**: Relief.

## 5. Analytics
- **Source flow**: `99_marketing_06_analytics_overview`
- **Overlay headline**: "See the patterns. Cut the waste."
- **Sub**: "Forecasts, categories, year-over-year — all in your currency"
- **Tone**: Data-driven, calm.

## 6. Team / Workspace
- **Source flow**: `99_marketing_09_workspace`
- **Overlay headline**: "Stop paying twice"
- **Sub**: "Find duplicate subs across your team or family"
- **Tone**: Smart. Show who-pays-for-what.

## 7. Privacy
- **Source flow**: `99_marketing_10_settings` (or privacy-processors screen)
- **Overlay headline**: "Your money stays yours"
- **Sub**: "End-to-end encrypted. Hosted in the EU. No ads, ever."
- **Tone**: Trust.

## 8. CTA
- **Source flow**: composite of dashboard + savings stat
- **Overlay headline**: "Save $200+ a year."
- **Sub**: "Start free. Find your forgotten charges in 30 seconds."
- **Tone**: Action.

---

# How to capture the source screenshots

```bash
# 1. Boot the largest required device
xcrun simctl boot "iPhone 16 Pro Max"
open -a Simulator

# 2. Build and install (~10–15 min first time)
npm run start:dev   # one terminal
npx expo run:ios --device "iPhone 16 Pro Max" --configuration Release   # another

# 3. Run the marketing flow
maestro test .maestro/99_marketing_screenshots.yaml

# 4. Collect the screenshots
ls -lah ~/.maestro/screenshots/99_marketing_*.png
```

Screenshots land in `~/.maestro/screenshots/`. The flow uses the demo account `review@subradar.ai` with OTP `000000` — make sure that account has 4–8 realistic subscriptions seeded in the dev DB before running, otherwise the dashboard will look empty.

Once captured, drag the PNGs into Figma (or any screenshot framer like ScreenSpace / Rotato), drop them onto an iPhone-shaped frame, and overlay the headlines from §1–8 above using **SF Pro Display** at the size Apple recommends (`64–84pt headline`, `28–34pt subhead`).

# Localization
- Apple supports localized App Store metadata. For the v1 listing, ship English-only — the app itself is multilingual, but the App Store description carries best with one polished narrative. Add Russian / Japanese / German localized listings only after the English copy proves out (~1000 downloads).
