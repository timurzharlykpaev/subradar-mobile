<!-- SHARED: subradar-backend, subradar-web, subradar-mobile -->
<!-- Canonical: subradar-backend/docs/BILLING_RULES.md -->
<!-- Synced: 2026-03-07 -->

# SubRadar AI — Billing Rules

## Plans

### Free
- Up to 5 subscriptions
- Manual add only
- Basic reminders (1 day before billing)
- Basic analytics (monthly total, category breakdown)
- 1 PDF summary per month
- No AI audit
- No OCR/photo AI
- No advanced insights

### Pro ($2.99/mo)
- Unlimited subscriptions
- AI add by text
- AI photo/screenshot parsing
- AI duplicate detection
- Advanced analytics + forecast (6mo, 12mo)
- Monthly AI audit
- Unlimited PDF reports
- Trial killer (trial tracking with alerts)
- Custom categories/tags
- Export history

### Team ($9.99/mo)
- Everything in Pro
- Workspace with multiple members
- Dashboards per employee
- Shared reports
- Budgeting
- Team audit
- Owner analytics
- Member invite/management

## Trial Trigger Logic

Trial must NOT start on first app launch or on empty account.

Trial triggers after ONE of these events:
1. User added 2 subscriptions
2. User opened AI insight for the first time
3. User clicked "Get audit"

This ensures user sees value before trial starts, preventing wasted trial days.

## Trial Duration
- 7 days of Pro features
- After trial: downgrade to Free (keep data, lose Pro features)

## Feature Gating

| Feature | Free | Pro | Team |
|---------|------|-----|------|
| Max subscriptions | 5 | Unlimited | Unlimited |
| Manual add | Yes | Yes | Yes |
| AI text add | No | Yes | Yes |
| AI photo add | No | Yes | Yes |
| AI duplicate detection | No | Yes | Yes |
| Basic analytics | Yes | Yes | Yes |
| Advanced analytics | No | Yes | Yes |
| Forecast (6mo, 12mo) | No | Yes | Yes |
| Monthly AI audit | No | Yes | Yes |
| PDF summary | 1/month | Unlimited | Unlimited |
| Trial killer | No | Yes | Yes |
| Custom tags | No | Yes | Yes |
| Export | No | Yes | Yes |
| Workspace | No | No | Yes |
| Team reports | No | No | Yes |
| Budgeting | No | No | Yes |

## Paywall Display

### Paywall Screen (`app/paywall.tsx`)
Premium plan selection with animated cards, billing period toggle, radio selection.
- 3 plan cards (Free/Pro/Team) with staggered entrance animation
- Plan-specific icons and colors: Free=gray, Pro=purple, Team=cyan
- Expandable feature list per card (included + missing)
- Dynamic CTA: trial start / upgrade / continue free
- Monthly/Yearly toggle with -30% save badge

### Subscription Plan Screen (`app/subscription-plan.tsx`)
Current plan details with usage bars, status badges, cancel flow.
- Hero card in plan color with decorative circles
- Progress bars for subscriptions + AI usage (red at 90%+)
- Action buttons: trial/upgrade/cancel

### Pro Feature Modal (`src/components/ProFeatureModal.tsx`)
Animated popup shown when user taps a Pro-gated section.
- Feature-specific icon + description (forecast, savings, AI, workspace)
- Pro benefits list + trial/upgrade CTA
- Replaces old "🔒 Upgrade" inline text

### Feature Gating Triggers
Paywall appears when:
- Free user hits subscription limit (AddSubscriptionSheet)
- Free user taps locked analytics section (ProFeatureModal)
- User taps "Upgrade" chip on subscriptions tab
- User taps plan card in Settings
- User enters Workspace without Team plan

## Billing Provider
- Lemon Squeezy (Merchant of Record)
- Webhook: `POST /billing/webhook` (verified by signature)
- Checkout: redirect to Lemon Squeezy hosted page
- Status sync via webhook events: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_payment_success`, `subscription_payment_failed`
