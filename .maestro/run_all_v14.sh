#!/usr/bin/env bash
# Run every Maestro flow mapped to v1.4.0 ClickUp sections.
# Per-section pass/fail summary on exit.
#
# Pre-flight (see COVERAGE.md):
#   - Booted iOS simulator (UDID via $SIM_UDID or auto-detect)
#   - Debug build at /tmp/subradar-build/Build/Products/Debug-iphonesimulator/SubRadar.app
#     built with EXPO_PUBLIC_E2E_MODE=1 + EXPO_PUBLIC_API_URL=api-dev
#   - Dev backend has ENABLE_REVIEW_ACCOUNT=true
#   - Dev DB seeded via `npm run seed:test-users`
#
# Usage:
#   ./run_all_v14.sh            # all sections
#   ./run_all_v14.sh 2 10       # only sections 2 and 10
#
# Each flow runs in a clean sim state: uninstall + keychain reset +
# install. Adds ~8s overhead per flow but prevents cross-flow auth
# leakage (iOS SecureStore persists across app-level clearState).
set -u
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export PATH="/opt/homebrew/opt/openjdk@17/bin:$HOME/.maestro/bin:$PATH"
export MAESTRO_CLI_NO_ANALYTICS=1

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

SIM_UDID="${SIM_UDID:-$(xcrun simctl list devices booted | grep -oE '[A-F0-9]{8}-([A-F0-9]{4}-){3}[A-F0-9]{12}' | head -1)}"
APP_PATH="${APP_PATH:-/tmp/subradar-build/Build/Products/Debug-iphonesimulator/SubRadar.app}"
BUNDLE_ID="com.goalin.subradar"

if [ -z "$SIM_UDID" ]; then
  echo "❌ no booted simulator. Run: xcrun simctl boot <UDID>"
  exit 1
fi
if [ ! -d "$APP_PATH" ]; then
  echo "❌ app not found at $APP_PATH"
  exit 1
fi

section_flows() {
  case "$1" in
    2)  echo "00_onboarding_flow 01_onboarding_language 02_onboarding_currency" ;;
    3)  echo "03_auth_email 21_logout" ;;
    4)  echo "20_dashboard_sanity 37_dashboard_navigation 45_pull_to_refresh 62_banner_renderer_priority" ;;
    5)  echo "04_add_subscription_manual 04b_add_subscription_ai 04g_add_subscription_new_fields 04i_success_overlay 29_bulk_add_text 38_add_manual_with_trial" ;;
    6)  echo "05_subscriptions_list 11_subscription_search 12_subscription_filter 35_filter_category 36_sort_subscriptions 42_subscription_swipe_delete" ;;
    7)  echo "04c_edit_subscription 04d_delete_subscription 04e_subscription_detail 22_subscription_detail_no_nulls 28_edit_subscription_form 31_subscription_detail_actions 51_subscription_pause_cancel 56_subscription_restore" ;;
    8)  echo "06_analytics 06b_analytics_redesign 13_analytics_forecast 14_analytics_categories 44_analytics_full" ;;
    9)  echo "23_settings_team_plan 27_workspace_flow 55_workspace_create_invite" ;;
    10) echo "08_paywall_limit 19_paywall_upgrade 24_paywall_flow 40_paywall_plans 60_paywall_prices_unavailable 61_restore_purchases_unified" ;;
    11) echo "07_settings_theme 15_settings_currency 16_settings_language 17_settings_notifications 18_profile_edit 26_settings_restore 33_settings_add_card_full 43_settings_full_flow" ;;
    12) echo "04f_trial_subscription 57_paywall_purchase_flow 70_billing_grace_banner 71_billing_issue_banner" ;;
    14) echo "_smoke_launch" ;;
    15) echo "39_error_states 99_full_user_journey" ;;
    *)  echo "" ;;
  esac
}

ORDER=(2 3 4 5 6 7 8 9 10 11 12 14 15)
if [ $# -gt 0 ]; then
  ORDER=("$@")
fi

reset_sim() {
  xcrun simctl terminate "$SIM_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl uninstall "$SIM_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl keychain "$SIM_UDID" reset >/dev/null 2>&1 || true
  xcrun simctl install "$SIM_UDID" "$APP_PATH" >/dev/null 2>&1
}

TOTAL_PASS=0
TOTAL_FAIL=0
FAILED_FLOWS=""
SECTION_REPORT=""

for sec in "${ORDER[@]}"; do
  flows="$(section_flows "$sec")"
  if [ -z "$flows" ]; then
    echo "⚠️  section $sec has no mapped flows"
    continue
  fi
  sec_pass=0
  sec_fail=0
  echo "━━━ Section $sec ━━━"
  for flow in $flows; do
    reset_sim
    printf "  %-40s " "$flow"
    if maestro test "$DIR/$flow.yaml" > "/tmp/maestro-$flow.log" 2>&1; then
      echo "✅"
      sec_pass=$((sec_pass+1))
    else
      echo "❌ /tmp/maestro-$flow.log"
      sec_fail=$((sec_fail+1))
      FAILED_FLOWS="$FAILED_FLOWS $sec:$flow"
    fi
  done
  TOTAL_PASS=$((TOTAL_PASS+sec_pass))
  TOTAL_FAIL=$((TOTAL_FAIL+sec_fail))
  SECTION_REPORT="$SECTION_REPORT\nsection $sec: $sec_pass pass / $sec_fail fail"
done

echo ""
echo "━━━ Summary ━━━"
printf "%b\n" "$SECTION_REPORT" | sed 's/^/  /'
echo "  ─────────────────────"
printf "  total      %d pass / %d fail\n" "$TOTAL_PASS" "$TOTAL_FAIL"

if [ -n "$FAILED_FLOWS" ]; then
  echo ""
  echo "Failed flows:"
  for f in $FAILED_FLOWS; do echo "  $f"; done
  exit 1
fi
