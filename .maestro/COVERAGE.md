# Maestro → ClickUp v1.4.0 coverage map

Each ClickUp QA v1.4.0 section with the Maestro flows that exercise it.
Flows marked **new-v1.4.0** were added in this sprint; the rest predate it
but are covered here for completeness. Run a section's flows against a
fresh simulator with `EXPO_PUBLIC_E2E_MODE=1` + `EXPO_PUBLIC_API_URL=api-dev`
for best stability.

| # | ClickUp section | Maestro flow(s) | Notes |
|---|-----------------|-----------------|-------|
| 1 | Pre-release Setup | — | manual QA + health endpoint curl, no UI |
| 2 | Onboarding | `00_onboarding_flow` **(updated v1.4.0)**, `01_onboarding_language`, `02_onboarding_currency` | v1.4.0 6-slide layout |
| 3 | Auth | `03_auth_email`, `21_logout`, `00_setup_auth` | review@ bypass + logout |
| 4 | Dashboard | `20_dashboard_charts`, `20_dashboard_sanity`, `37_dashboard_navigation`, `45_pull_to_refresh`, `62_banner_renderer_priority` **(new)** | |
| 5 | Add Subscription | `04_add_subscription_manual`, `04b_add_subscription_ai`, `04g_add_subscription_new_fields`, `04h_voice_tap_to_record`, `04i_success_overlay`, `29_bulk_add_text`, `30_bulk_add_voice`, `38_add_manual_with_trial`, `41_add_subscription_ai_wizard`, `50_screenshot_scan`, `52_ai_confirm_and_edit`, `53_ai_bulk_edit` | |
| 6 | Subscriptions List | `05_subscriptions_list`, `11_subscription_search`, `12_subscription_filter`, `35_filter_category`, `36_sort_subscriptions`, `42_subscription_swipe_delete` | |
| 7 | Subscription Detail & Edit | `04c_edit_subscription`, `04d_delete_subscription`, `04e_subscription_detail`, `22_subscription_detail_no_nulls`, `22_deep_link_subscription`, `28_edit_subscription_form`, `31_subscription_detail_actions`, `51_subscription_pause_cancel`, `56_subscription_restore` | |
| 8 | Analytics | `06_analytics`, `06b_analytics_redesign`, `13_analytics_forecast`, `14_analytics_categories`, `44_analytics_full` | |
| 9 | Workspace (Team) | `23_settings_team_plan`, `27_workspace_flow`, `55_workspace_create_invite` | seeded users: `qa-team-owner@`, `qa-team-member@` |
| 10 | Paywall | `08_paywall_limit`, `19_paywall_upgrade`, `24_paywall_flow`, `25_ai_wizard_plans`, `40_paywall_plans`, `57_paywall_purchase_flow`, `60_paywall_prices_unavailable` **(new)**, `61_restore_purchases_unified` **(new)** | |
| 11 | Settings | `07_settings_theme`, `09_cards_flow`, `15_settings_currency`, `16_settings_language`, `17_settings_notifications`, `18_profile_edit`, `26_settings_restore`, `32_settings_delete_card`, `33_settings_add_card_full`, `43_settings_full_flow` | |
| 12 | Billing Scenarios | `04f_trial_subscription`, `38_add_manual_with_trial`, `57_paywall_purchase_flow`, `70_billing_grace_banner` **(new)**, `71_billing_issue_banner` **(new)** | banner states driven by seed users |
| 13 | Email Notifications | — | backend-only (suppression/unsub/resend webhook) — covered by Jest specs |
| 14 | Cross-functional | `07_settings_theme`, `15_settings_currency`, `16_settings_language`, `_smoke_launch` | locale × theme |
| 15 | Regression | `39_error_states`, `99_full_user_journey`, `10b_reports_retry`, `62_banner_renderer_priority` | |

## Runners

- `run_all_v14.sh` — runs every flow above in dependency order, reports per-section pass/fail to stdout.
- `_smoke_launch.yaml` — bare smoke, first line of defence.
- `_dismiss_logbox.yaml` — helper that any flow can `runFlow:` to clear dev-mode LogBox overlays.

## Pre-flight env (dev sim builds)

```bash
# App build
EXPO_PUBLIC_E2E_MODE=1 \
EXPO_PUBLIC_API_URL=https://api-dev.subradar.ai/api/v1 \
xcodebuild -workspace ios/SubRadar.xcworkspace -scheme SubRadar \
  -configuration Debug \
  -destination "platform=iOS Simulator,id=<UDID>" \
  -derivedDataPath /tmp/subradar-build build

# Backend (dev only, never prod)
ssh droplet 'docker exec subradar-api-dev printenv ENABLE_REVIEW_ACCOUNT'
# should print "true" — required for review@subradar.ai OTP bypass.

# Seeded users (dev DB)
cd subradar-backend && npm run seed:test-users
```
