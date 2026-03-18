# PROGRESS.md — subradar-mobile

_Update this file after completing each feature or fix._

---

## Completed

### Infrastructure
- [x] Expo SDK 51 + TypeScript strict
- [x] Expo Router (file-based routing)
- [x] TanStack Query v5 + Zustand
- [x] Axios API client
- [x] AsyncStorage for tokens

### Auth
- [x] Google OAuth (mobile flow)
- [x] Token refresh logic

### Basic UI
- [x] Tab navigation (Dashboard, Subscriptions, Analytics, Settings)
- [x] Onboarding screen

---

## MVP Screen Status (per docs/MOBILE_SCREENS.md)

| Screen | Status |
|--------|--------|
| Splash | Pending |
| Welcome | Pending |
| Auth | Partial (Google works) |
| Onboarding (5 steps) | Partial (basic slides) |
| Home Dashboard | Pending |
| Subscriptions List | Pending |
| Add Subscription Entry | Pending |
| Manual Add | Pending |
| AI Text Add | Pending |
| Photo/Screenshot Add | Pending |
| AI Review | Pending |
| Subscription Detail | Pending |
| Analytics | Pending |
| Reports | Pending |
| Settings | Pending |
| Cards | Pending |
| Billing/Paywall | Done (premium redesign) |

---

## Backlog

- [ ] Splash screen with token check and routing
- [ ] Welcome screen (marketing + auth CTA)
- [ ] Full onboarding flow (5 steps per PRD)
- [ ] Home dashboard with 9 blocks
- [ ] Subscriptions list with filters and sorting
- [ ] Add subscription entry modal (3 options)
- [ ] Manual add form with validation
- [ ] AI text add with clarification flow
- [ ] Photo/screenshot add with AI parsing
- [ ] AI review screen (confirm before save)
- [ ] Subscription detail screen
- [ ] Analytics screen with charts
- [ ] Reports screen with PDF generation
- [ ] Settings screen
- [ ] Cards management
- [x] Billing/paywall screen (premium redesign with animations, ProFeatureModal, subscription-plan)
- [x] Push notifications (FCM registration + reminders — native device token, backend saves + cron sends)
- [ ] Apple Sign-In
- [ ] Magic Link auth
- [ ] Empty state components per screen
- [ ] Error state components per screen
