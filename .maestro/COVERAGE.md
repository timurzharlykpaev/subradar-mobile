# Maestro coverage map (HARD-assert suite)

Canonical runner: **`run_all.sh`** (`npm run test:e2e`). Organised by ClickUp QA
section, one clean-sim install per flow. Legacy `run_all_v14.sh` kept for
reference only — `run_all.sh` supersedes it.

Pre-flight: booted iOS sim, Debug build (`EXPO_PUBLIC_E2E_MODE=1` +
`EXPO_PUBLIC_API_URL=api-dev`), dev backend `ENABLE_REVIEW_ACCOUNT=true`
(OTP `000000`), dev DB seeded (`cd subradar-backend && npm run seed:test-users`).

`[seed]` = needs a seeded `qa-*@subradar.test` account (logs in via `_login_as.yaml`).

| # | Section | Hard flows | Notes |
|---|---------|-----------|-------|
| 2 | Onboarding | `00_onboarding_flow`, `01_onboarding_language`, `02_onboarding_currency` | |
| 3 | Auth | `03_auth_email`, `21_logout`, `140_auth_logout_login` | logout → onboarding asserted |
| 4 | Dashboard | `150_dashboard_populated`, `151_dashboard_navigation`, `20_dashboard_sanity`, `37_dashboard_navigation`, `45_pull_to_refresh`, `62_banner_renderer_priority` | |
| 5 | Add Subscription | `100_sub_add_manual_verify`, `101_sub_add_ai_verify`, `80_subscription_add_manual`, `29_bulk_add_text` | 100 verifies the card actually lands in the list |
| 6 | Subscriptions List | `110_sub_search_results`, `111_sub_filter_status`, `112_sub_sort`, `116_sub_longpress_menu`, `117_sub_duplicate_detection`, `81_subscriptions_list_filters` | search/filter assert positive **and** negative results |
| 7 | Detail / Edit / Delete | `102_sub_edit_amount_persist`, `103_sub_edit_name_persist`, `104_sub_edit_fields`, `105_sub_delete_commit`, `106_sub_delete_undo`, `113_sub_lifecycle_pause_resume`, `114_sub_lifecycle_cancel`, `115_sub_restore_cancelled`, `82_subscription_detail_edit_delete`, `22_subscription_detail_no_nulls` | edits re-open detail to prove persistence |
| 8 | Analytics | `152_analytics_populated`, `153_analytics_scroll_sections`, `44_analytics_full`, `13_analytics_forecast`, `14_analytics_categories` | |
| 9 | Workspace (Team) | `154_workspace_create` `[seed]`, `155_team_owner_manage` `[seed]`, `93_team_subscription_flows` `[seed]` | create needs Team plan (`qa-team-fresh`) |
| 10 | Paywall | `120_paywall_open_plans`, `121_paywall_pro_current` `[seed]`, `122_paywall_team_current` `[seed]`, `123_trial_offer_modal`, `124_paywall_purchase_start`, `60_paywall_prices_unavailable`, `61_restore_purchases_unified` | current-plan badge asserted via seeded Pro/Team |
| 11 | Settings / Cards | `141_settings_theme_toggle`, `142_profile_edit_persist`, `143_cards_add`, `144_cards_delete`, `145_settings_notifications`, `146_settings_reminder_days`, `07_settings_theme`, `26_settings_restore` | |
| 12 | Billing / Retention | `70_billing_grace_banner` `[seed]`, `71_billing_issue_banner` `[seed]`, `90_retention_winback` `[seed]`, `130_banner_winback_old` `[seed]`, `91_retention_degraded_softgate` `[seed]`, `92_retention_billing_banners` `[seed]`, `94_retention_progate_limit` `[seed]` | seed→banner map below |
| 14 | Smoke | `_smoke_launch` | |
| 15 | Regression | `39_error_states`, `99_full_user_journey` | |

## Seed → banner priority map (verified vs backend `banner-priority.ts`)

| Seed email | priority | banner testID |
|---|---|---|
| `qa-pro-grace` | grace | `grace-banner` |
| `qa-pro-billing-issue` | billing_issue | `billing_issue-banner` |
| `qa-winback-recent` (d3_7) | win_back | `win_back-banner` |
| `qa-winback-old` (d8_30) | win_back | `win_back-banner` |

## Excluded from the runner (kept on disk, superseded)

- **Stubs** (navigate only, no action): `04c_edit_subscription`, `04d_delete_subscription`, `04e_subscription_detail`.
- **Test non-existent controls**: `51_subscription_pause_cancel`, `56_subscription_restore` (UI has no pause/resume/restore — see bugs).
- **Soft duplicates**: `05_subscriptions_list`, `11_search_subscription`, `11_subscription_search`, `12_filter_status`, `12_subscription_filter`.
- **Invalid YAML** (pre-existing, parse-fail): `33_settings_add_card_full`, `34_reports_generate`, `38_add_manual_with_trial`, `40_paywall_plans`, `43_settings_full_flow`.

## Product bugs / gaps found while writing the suite

1. **`btn-manual-toggle` never existed** — the old "gold" flows (`80/82/85/88`) tapped a non-existent id; real control is `hero-manual` (IdleView.tsx:416). Fixed across all flows.
2. **Pause / resume / restore not wired** — `subscriptionsApi.pause`/`restore` exist but no screen calls them; detail screen only offers cancel/edit/delete. `113`/`115` assert this *absence* (regression guards). If pause/restore are intended features, they're missing in the UI.
3. **Long-press "Edit" opens nothing** — list long-press routes to `/subscription/:id?edit=1`, but the detail screen ignores the `edit` param (no effect on mount). Edit only opens via `btn-edit-sub`.
4. **Retention seeds incomplete** — `expiration` / `double_pay` / `annual_upgrade` / `refund` banners have no working seed (need `billingSource='revenuecat'`; `double_pay` seed isn't linked to a workspace). `131-133` not written until seeds are fixed.

## TestIDs worth adding (would harden currently text-anchored steps)

- `EditSubscriptionSheet.tsx`: `edit-name-input`, `edit-amount-input` (886/903).
- `UndoToast.tsx`: `undo-toast`, `btn-undo`.
- `edit-profile.tsx`: `input-profile-name`, `btn-save-profile`.
- `paywall.tsx`: `btn-cta-purchase` (978) — only unstable match in the paywall section.
