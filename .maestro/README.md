# E2E Tests — Maestro

## Setup
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
export PATH="$PATH:$HOME/.maestro/bin"
maestro --version
```

## Run all tests
```bash
# App must be running on simulator or device first
.maestro/run_all.sh
```

## Run single flow
```bash
maestro test .maestro/04_add_subscription_manual.yaml
```

## Flows

| # | File | Scenario |
|---|------|----------|
| 01 | `01_onboarding_language` | Language selection |
| 02 | `02_onboarding_currency` | Currency selection |
| 03 | `03_auth_email` | Email OTP flow |
| 04 | `04_add_subscription_manual` | Add subscription manually |
| 04b | `04b_add_subscription_ai` | Add via AI search |
| 04c | `04c_edit_subscription` | Edit amount |
| 04d | `04d_delete_subscription` | Delete + confirm |
| 04e | `04e_subscription_detail` | Detail: no undefined/null/NaN |
| 04f | `04f_trial_subscription` | Trial badge in list |
| 05 | `05_subscriptions_list` | Subscriptions list |
| 06 | `06_analytics` | Analytics screen |
| 07 | `07_settings_theme` | Theme toggle |
| 08 | `08_paywall_limit` | Free plan paywall |
| 09 | `09_cards_flow` | Add/list/delete card |
| 10 | `10_reports_flow` | Generate report |
| 11 | `11_search_subscription` | Search by name |
| 12 | `12_filter_status` | Filter Active/Trial |
| 13 | `13_analytics_forecast` | Forecast: no NaN |
| 14 | `14_analytics_categories` | Categories: no NaN |
| 15 | `15_settings_currency` | Change currency |
| 16 | `16_settings_language` | Change language |
| 17 | `17_settings_notifications` | Notifications settings |
| 18 | `18_profile_edit` | Edit profile name |
| 19 | `19_paywall_upgrade` | Upgrade screen |
| 20 | `20_dashboard_sanity` | Dashboard: no NaN/undefined, has Прогноз |
| 21 | `21_logout` | Logout → see SubRadar |
| 22 | `22_subscription_detail_no_nulls` | Detail: no undefined/null |
| 23 | `23_settings_team_plan` | Settings: Team plan, pull-to-refresh, edit profile |
| 24 | `24_paywall_flow` | Paywall: open, view plans, close |
| 25 | `25_ai_wizard_plans` | AI Wizard: search + plans selection |
| 26 | `26_settings_restore` | Settings: Restore Purchases |

## Notes
- All `optional: true` assertions mean the element **may not exist** (navigation varies by state).
- Flows are designed to be resilient — they won't fail on missing optional UI elements.
- For CI, use `maestro cloud` or run against a simulator started before the job.
