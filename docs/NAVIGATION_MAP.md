# SubRadar AI — Mobile Navigation Map

## Root Flows

### Flow A: Unauthenticated user
```
Splash -> Welcome -> Auth (Google / Apple / Magic Link)
```

### Flow B: New authenticated user (onboarding)
```
Onboarding Step 1 (Product value)
  -> Step 2 (Choose: Personal / Team)
  -> Step 3 (Preferences: country, currency, timezone, locale)
  -> Step 4 (Notifications permission education + system prompt)
  -> Step 5 (Add first subscription: manual / AI / photo)
  -> Main App
```

### Flow C: Main app (tab navigation)
Bottom tab bar:
```
Home | Subscriptions | Analytics | Reports | Settings
```

## Overlay Screens (open on top of tabs)

- Add Subscription Entry (bottom sheet / modal)
- Manual Add Subscription
- AI Text Add Subscription
- Photo/Screenshot Add Subscription
- AI Review (confirmation before save)
- Subscription Detail
- Edit Subscription
- Billing / Paywall
- Notification Settings
- Cards Management
- Workspace screens (later)

## Screen Flow Diagram

```
                    ┌──────────┐
                    │  Splash  │
                    └────┬─────┘
                         │
              ┌──────────┴──────────┐
              │ has valid token?     │
              └──┬──────────────┬───┘
                 │ No           │ Yes
                 v              v
           ┌─────────┐   ┌──────────────┐
           │ Welcome  │   │ Onboarding   │ (if not completed)
           └────┬─────┘   │ completed?   │
                │         └──┬───────┬───┘
                v            │ No    │ Yes
           ┌─────────┐      v       v
           │  Auth    │  Onboarding  Main App
           └────┬─────┘  (5 steps)   (tabs)
                │            │
                v            v
           ┌──────────────────────┐
           │      Main App        │
           │  ┌────┬────┬────┬──┐ │
           │  │Home│Subs│Ana │Rep│Set│
           │  └────┴────┴────┴──┘ │
           └──────────────────────┘
```

## Add Subscription Flow

```
Any screen with "Add" button
  -> Add Subscription Entry (3 options)
     ├── Add manually -> Manual Add Form -> Save -> Detail
     ├── Add with AI text -> AI Text Input -> Processing -> AI Review -> Save -> Detail
     └── Add from photo -> Photo picker -> Processing -> AI Review -> Save -> Detail
```

## Deep Links (future)

- `subradar://invite/:code` — Workspace invite
- `subradar://billing/success` — After checkout
- `subradar://report/:id` — Open specific report
- `subradar://subscription/:id` — Open subscription detail
