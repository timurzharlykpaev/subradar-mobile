# SubRadar AI — Mobile Screen-by-Screen PRD

## Goal
This document describes every screen in the mobile app with UI blocks, states, analytics events, and backend dependencies.

---

## 1. Splash Screen

**Purpose:** Bootstrap, token check, session restore, routing decision.

**Behavior:**
1. Show logo + brand mark
2. Check access_token / refresh_token
3. If valid: fetch profile, onboarding status, current plan
4. Route to: Auth flow / Onboarding / Main app

**UI:** Logo centered, soft animation, loading indicator, no buttons.

**States:**
- Loading: shimmer until bootstrap completes
- Error: show retry + "Continue to sign in" fallback

**Events:** `app_opened`, `session_restore_started`, `session_restore_success`, `session_restore_failed`

**Backend:** `POST /auth/refresh`, `GET /auth/me`

---

## 2. Welcome Screen

**Purpose:** First marketing screen, explain product value, lead to auth.

**UI blocks:**
1. Hero title: "Control all subscriptions in one place"
2. Short description
3. 3 benefit cards: Track subscriptions / Avoid unwanted renewals / Save money with AI
4. Primary CTA: "Continue with Google"
5. Secondary: "Sign in" (for existing users)
6. Privacy/Terms link

**States:**
- Default: normal screen with CTA
- Loading: during auth flow start
- Error: toast/inline if auth flow fails

**Events:** `welcome_viewed`, `welcome_google_click`, `welcome_signin_click`

---

## 3. Auth Screen

**Purpose:** Execute Google/Apple auth flow.

**Behavior:**
1. Start Google/Apple sign-in
2. Get token
3. Send to backend
4. Get app session
5. Redirect: onboarding (new) or home (existing)

**UI:** Logo, 1 primary CTA, loader during auth, error message on failure.

**Edge cases:** User cancelled login, network unavailable, backend auth failed, account suspended.

**Events:** `auth_started_google`, `auth_success_google`, `auth_failed_google`, `auth_cancelled_google`

**Backend:** `POST /auth/google/mobile`, `POST /auth/apple`

---

## 4. Onboarding

### Step 1 — Product Value
Show: all subscriptions in one place, billing alerts, AI help, analytics/forecasts.
UI: illustration/mock dashboard, headline, subtitle, Next button.
**Events:** `onboarding_step_1_viewed`, `onboarding_step_1_next`

### Step 2 — Choose Usage Type
Options: Personal / Team-Business.
UI: 2 selectable cards with descriptions, Continue button.
**Events:** `onboarding_usage_selected_personal`, `onboarding_usage_selected_team`

### Step 3 — Preferences
Fields: country, default currency, timezone, locale/language.
Behavior: auto-detect from device, allow editing.
**Events:** `onboarding_preferences_saved`
**Backend:** `PATCH /users/preferences`

### Step 4 — Notifications Permission
First show education screen: "Enable notifications to never miss billing or trial expiry"
CTA: "Enable notifications" / "Maybe later"
After tap: trigger system permission dialog.
**Events:** `notifications_education_viewed`, `notifications_permission_requested`, `notifications_permission_granted`, `notifications_permission_denied`

### Step 5 — Add First Subscription
Don't let user into empty app.
CTA options: Add manually / Add with AI / Add from screenshot
**Events:** `onboarding_add_first_subscription_viewed`, `onboarding_add_first_subscription_manual`, `onboarding_add_first_subscription_ai_text`, `onboarding_add_first_subscription_ai_photo`

---

## 5. Home Screen

**Purpose:** Main dashboard. Show value in 3-5 seconds.

### Blocks
1. **Header** — greeting, avatar, plan badge, Add button, workspace switcher (later)
2. **Main spend card** — total monthly spend, yearly estimate, delta vs previous month
3. **Forecast snapshot** — next 30 days, next 6 months, next 12 months
4. **Upcoming charges** — list: service, date, amount, status
5. **Trials ending soon** — list: service, days left, first charge amount, view/edit CTA
6. **Potential savings** — estimated monthly savings, duplicates detected, overlapping subs, run audit CTA
7. **Category chart** — pie/bar: entertainment, AI tools, work, cloud, music, etc.
8. **Recent subscriptions** — last added
9. **Quick actions** — Add subscription, Run AI audit, Generate PDF, Upgrade to Pro

### States
- **Empty:** hero card "Add your first subscription" with 3 CTAs
- **Partial (1-2 subs):** simplified cards, encourage adding more
- **Full:** all blocks visible
- **Error:** retry card, keep quick actions visible

**Events:** `home_viewed`, `home_add_subscription_click`, `home_run_audit_click`, `home_generate_report_click`, `home_upgrade_click`, `home_upcoming_subscription_click`, `home_trial_click`

**Backend:** `GET /analytics/home`, `GET /analytics/upcoming`, `GET /analytics/trials`, `GET /analytics/forecast`, `GET /analytics/savings`

---

## 6. Subscriptions List

**Purpose:** Main working list of all subscriptions.

### Elements
- **Header:** title "Subscriptions", search icon/field, add button
- **Filter row:** All / Active / Trial / Paused / Cancelled
- **Secondary filters:** category, tags, business expense, card, billing period
- **Sorting:** next billing date, amount high-low, amount low-high, name A-Z, most recently added

### List item card
- Icon, service name, plan name (optional), amount + currency + period, next billing date, status badge, trial badge, duplicate badge, card last4

### Search
Searches by: name, tags, category label, notes (later).

### Empty states
- No subscriptions: CTA to add first
- Filter returned nothing: reset filters / clear search

### Swipe actions (later)
Archive, pause, delete — in first release, prefer tap -> detail.

**Events:** `subscriptions_viewed`, `subscriptions_search_used`, `subscriptions_filter_changed`, `subscriptions_sort_changed`, `subscription_card_opened`, `subscription_add_click_from_list`

**Backend:** `GET /subscriptions`

---

## 7. Add Subscription Entry

**Purpose:** Entry point — choose how to add.

**Options:**
1. Add manually
2. Add with AI text
3. Add from photo/screenshot

**UI:** Bottom sheet or modal, 3 large cards with brief descriptions.
**UX rule:** Decision in 1-2 seconds, no text overload.

**Events:** `add_subscription_entry_viewed`, `add_subscription_manual_selected`, `add_subscription_ai_text_selected`, `add_subscription_photo_selected`

---

## 8. Manual Add Subscription

**Required fields:** Service name, Amount, Currency, Billing period, Next billing date
**Optional fields:** Category, Plan name, Start date, Status, Trial end date, Card, Tags, Business expense, Notes, Reminder settings

**Behavior:**
- Status = Trial: show trial end date, first charge date/amount
- Period = Yearly: show equivalent monthly cost + yearly total
- Service name entered: soft suggest icon/service matching (non-intrusive)

**Validation:** amount > 0, valid currency, valid dates, billing period required

**Success:** toast "Subscription added", refresh analytics, redirect to detail

**States:** pristine, editing, validation error, saving, success, save failed

**Events:** `manual_add_viewed`, `manual_add_save_clicked`, `manual_add_saved`, `manual_add_failed`, `manual_add_cancelled`

**Backend:** `POST /subscriptions`

---

## 9. AI Text Add

**Purpose:** Add subscription from natural language text.

**UI:**
- Large text input with placeholder examples
- Multiline support
- Prompt helper chips: "Netflix 9.99 USD monthly", "Adobe yearly plan", "Trial ends in 5 days"
- Analyze + Cancel buttons

**After submit:**
- Processing: loader + "Analyzing your subscription..."
- AI builds form -> go to AI Review
- AI needs clarification -> show 1-3 questions (quick-select, not free text)
- AI failed -> offer manual entry

**States:** default, processing, clarification, parsed (summary preview + "Review" CTA), failed

**Events:** `ai_text_add_viewed`, `ai_text_submitted`, `ai_text_parse_success`, `ai_text_parse_failed`, `ai_text_clarification_started`, `ai_text_clarification_completed`

**Backend:** `POST /ai/parse-text-subscription`

---

## 10. Photo/Screenshot Add

**Purpose:** Add subscription from image.

**Entry options:** Take photo / Choose from gallery
**Permissions:** Request camera/gallery only on specific action, not upfront.

**Steps:**
1. Select/take photo
2. Preview image
3. Send to AI parsing
4. Get result
5. Go to AI Review

**AI extracts:** service name, amount, currency, billing period, date, trial, plan, website/domain

**Confidence behavior:**
- High: show structured preview
- Medium: show multiple brand options, ask to confirm service
- Low: offer manual correction / switch to manual add

**States:** empty, selected (preview), uploading/processing, parsed (summary), failed ("Could not reliably recognize" + Try again / Add manually)

**Events:** `photo_add_viewed`, `photo_picker_opened`, `photo_selected`, `photo_parse_started`, `photo_parse_success`, `photo_parse_failed`

**Backend:** `POST /ai/parse-subscription-image`

---

## 11. AI Review Screen

**Purpose:** Confirm AI result before saving. CRITICAL: Never save AI data without review.

**Shows:**
- Service name, icon, amount, currency, billing period, next billing date, trial data, category, card info, confidence (optional)
- All fields editable
- Suggestion area: duplicate detected, matching service, icon/site suggestion

**Actions:** Confirm and save, Edit fields, Cancel

**If AI not sure about service:** "Is this the correct subscription?" with options: Netflix / Netflix Premium / Another service / Custom name

**If duplicate found:** Warning "You might already have a similar subscription" with: Save anyway / Review existing

**States:** ready for confirmation, editing, duplicate warning, saving, success, save failed

**Events:** `ai_review_viewed`, `ai_review_field_edited`, `ai_review_confirm_clicked`, `ai_review_saved`, `ai_review_duplicate_warning_shown`, `ai_review_cancelled`

**Backend:** `POST /subscriptions`, `POST /ai/match-service`

---

## 12. Subscription Detail

**Purpose:** Full view and management of a single subscription.

### Sections
- **Header:** back, service name, icon, edit action
- **Main info:** amount, currency, period, plan, status
- **Billing:** next billing date, start date, yearly projection, monthly equivalent (if yearly)
- **Trial:** (if TRIAL) trial end date, first charge date, first charge amount
- **Payment card:** nickname, last4, brand
- **AI insights:** duplicate risk, cheaper option (later), overlapping sub, estimated annual cost
- **Reminders:** enabled/disabled, offsets
- **Links:** service website, manage plan, cancel link (later)
- **Notes/tags:** notes, tags, business expense flag

### Actions
Edit, Pause, Cancel, Archive, Duplicate merge (later), Attach receipt (later)

**States:** loading, loaded, error (retry)

**Events:** `detail_viewed`, `detail_edit_clicked`, `detail_pause_clicked`, `detail_cancel_clicked`, `detail_archive_clicked`

**Backend:** `GET /subscriptions/:id`

---

## 13. Analytics Screen

**Purpose:** Deep analytics — one of the main reasons to pay for Pro.

### Sections
1. Monthly total
2. Yearly estimate
3. Category distribution (chart)
4. Active vs Trial vs Cancelled
5. Spending trend by month (chart)
6. Most expensive subscriptions
7. Duplicate risk
8. Possible savings
9. Personal vs Business expense split
10. Card-based breakdown

### Filters
Month range, category, status, currency, workspace/personal scope

**States:** loading, empty (add subs to see analytics), full, error (retry)

**Events:** `analytics_viewed`, `analytics_filter_changed`, `analytics_category_tapped`, `analytics_savings_tapped`

**Backend:** `GET /analytics/home`, `GET /analytics/trends`, `GET /analytics/categories`, `GET /analytics/savings`

---

## 14. Reports Screen

**Purpose:** Generate and view PDF reports.

### Elements
- List of previously generated reports
- Generate report button
- Report types: Summary, Detailed, Audit, Tax (later)
- Period selector
- Generation status (PENDING -> GENERATING -> READY / FAILED)

**States:** loading, empty (generate first report), list, generating

**Events:** `reports_viewed`, `report_generate_clicked`, `report_downloaded`, `report_generation_failed`

**Backend:** `GET /reports`, `POST /reports`, `GET /reports/:id/download`

---

## 15. Settings Screen

### Sections
1. Profile (name, email, avatar)
2. Currency / Locale / Timezone
3. Notifications preferences
4. Billing / Plan (current plan, upgrade CTA)
5. Cards management
6. Connected features
7. Data export
8. Delete account
9. Support / Feedback
10. Privacy info

**Events:** `settings_viewed`, `settings_plan_tapped`, `settings_notifications_tapped`

---

## 16. Cards Screen

**Purpose:** Manage payment card metadata.

**Stored:** nickname, brand, last4, color (UI), default flag.
**NOT stored:** full PAN, CVC, expiry.

**Events:** `cards_viewed`, `card_added`, `card_deleted`

**Backend:** `GET /cards`, `POST /cards`, `PATCH /cards/:id`, `DELETE /cards/:id`

---

## 17. Billing / Paywall Screen

**Purpose:** Clear plan comparison and upgrade path.

**Shows:** Free vs Pro vs Team features, pricing, upgrade CTA, current plan status.

**Events:** `paywall_viewed`, `paywall_upgrade_clicked`, `paywall_plan_selected`

**Backend:** `GET /billing/plans`, `POST /billing/checkout`

---

## 18. Workspace Screens (later, not MVP)

1. Create workspace
2. Members list
3. Invite member
4. Team analytics
5. Team reports
6. Budget settings
