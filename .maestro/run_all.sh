#!/usr/bin/env bash
# SubRadar E2E — canonical Maestro runner (HARD-assert suite).
#
# Supersedes the old 26-flow ORDERED list. Organised by ClickUp QA section,
# preferring the hard-assert flows (100-159) over the legacy soft/stub ones.
# Each flow runs in a clean sim state (uninstall + keychain reset + install)
# because iOS SecureStore persists auth across app-level clearState — without
# the reset, seeded-account logins (_login_as.yaml) leak across flows.
#
# Pre-flight (see COVERAGE.md):
#   - Booted iOS simulator (UDID via $SIM_UDID or auto-detect)
#   - Debug build at $APP_PATH built with EXPO_PUBLIC_E2E_MODE=1 +
#     EXPO_PUBLIC_API_URL=api-dev
#   - Dev backend has ENABLE_REVIEW_ACCOUNT=true (OTP 000000 bypass)
#   - Dev DB seeded: `cd subradar-backend && npm run seed:test-users`
#
# Usage:
#   ./run_all.sh              # every section
#   ./run_all.sh 5 7 10       # only the listed sections
#
# Legacy: run_all_v14.sh is kept for reference but this file is canonical.
set -u
export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}
export PATH="/opt/homebrew/opt/openjdk@17/bin:$HOME/.maestro/bin:$PATH"
export MAESTRO_CLI_NO_ANALYTICS=1

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

if ! command -v maestro &>/dev/null; then
  echo "❌ Maestro not found. Install: curl -Ls https://get.maestro.mobile.dev | bash"
  exit 1
fi

SIM_UDID="${SIM_UDID:-$(xcrun simctl list devices booted | grep -oE '[A-F0-9]{8}-([A-F0-9]{4}-){3}[A-F0-9]{12}' | head -1)}"
APP_PATH="${APP_PATH:-/tmp/subradar-build/Build/Products/Debug-iphonesimulator/SubRadar.app}"
BUNDLE_ID="com.goalin.subradar"

if [ -z "$SIM_UDID" ]; then
  echo "❌ no booted simulator. Run: xcrun simctl boot <UDID>"
  exit 1
fi
if [ ! -d "$APP_PATH" ]; then
  # Fall back to a recursive search (path layout differs across Xcode versions)
  APP_PATH=$(find /tmp/subradar-build -name "SubRadar.app" -not -path "*/PlugIns/*" 2>/dev/null | head -1)
fi
if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
  echo "❌ app not found. Build first or set APP_PATH=…/SubRadar.app"
  exit 1
fi
echo "📱 sim: $SIM_UDID"
echo "📦 app: $APP_PATH"

# Canonical per-section flow map. Hard-assert flows preferred; known-broken
# legacy flows (btn-manual-toggle stubs 04c/04d/04e, non-existent pause/restore
# 51/56, soft duplicates 05/11_*/12_*, invalid-yaml 33/34/38/40/43) excluded.
# Flows tagged [seed] require the dev DB seeded with qa-*@subradar.test users.
section_flows() {
  case "$1" in
    2)  echo "00_onboarding_flow" ;;  # 01/02 dropped: stale (language picker removed, currency auto-skips); 00 covers onboarding hard
    3)  echo "03_auth_email 21_logout 140_auth_logout_login" ;;
    4)  echo "150_dashboard_populated 151_dashboard_navigation 20_dashboard_sanity 37_dashboard_navigation 45_pull_to_refresh 62_banner_renderer_priority" ;;
    5)  echo "100_sub_add_manual_verify 101_sub_add_ai_verify 80_subscription_add_manual 29_bulk_add_text" ;;
    6)  echo "110_sub_search_results 111_sub_filter_status 112_sub_sort 116_sub_longpress_menu 117_sub_duplicate_detection 81_subscriptions_list_filters" ;;
    7)  echo "102_sub_edit_amount_persist 103_sub_edit_name_persist 104_sub_edit_fields 105_sub_delete_commit 106_sub_delete_undo 113_sub_lifecycle_pause_resume 114_sub_lifecycle_cancel 115_sub_restore_cancelled 82_subscription_detail_edit_delete 22_subscription_detail_no_nulls" ;;
    8)  echo "152_analytics_populated 153_analytics_scroll_sections 44_analytics_full 13_analytics_forecast 14_analytics_categories" ;;
    9)  echo "154_workspace_create 155_team_owner_manage 93_team_subscription_flows" ;;
    10) echo "120_paywall_open_plans 121_paywall_pro_current 122_paywall_team_current 123_trial_offer_modal 124_paywall_purchase_start 60_paywall_prices_unavailable 61_restore_purchases_unified" ;;
    11) echo "141_settings_theme_toggle 142_profile_edit_persist 143_cards_add 144_cards_delete 145_settings_notifications 146_settings_reminder_days 07_settings_theme 26_settings_restore" ;;
    12) echo "70_billing_grace_banner 71_billing_issue_banner 90_retention_winback 130_banner_winback_old 91_retention_degraded_softgate 92_retention_billing_banners 94_retention_progate_limit" ;;
    14) echo "_smoke_launch" ;;
    15) echo "39_error_states 99_full_user_journey" ;;
    *)  echo "" ;;
  esac
}

ORDER=(2 3 4 5 6 7 8 9 10 11 12 14 15)
if [ $# -gt 0 ]; then ORDER=("$@"); fi

reset_sim() {
  xcrun simctl terminate "$SIM_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl uninstall "$SIM_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl keychain "$SIM_UDID" reset >/dev/null 2>&1 || true
  xcrun simctl install "$SIM_UDID" "$APP_PATH" >/dev/null 2>&1
}

TOTAL_PASS=0; TOTAL_FAIL=0; FAILED_FLOWS=""; SECTION_REPORT=""

for sec in "${ORDER[@]}"; do
  flows="$(section_flows "$sec")"
  [ -z "$flows" ] && { echo "⚠️  section $sec has no mapped flows"; continue; }
  sec_pass=0; sec_fail=0
  echo "━━━ Section $sec ━━━"
  for flow in $flows; do
    [ -f "$DIR/$flow.yaml" ] || { echo "  ⚠️  $flow.yaml missing — skipped"; continue; }
    # Clear review's backend subscriptions so add-flows never hit the free limit.
    "$DIR/reset_review_subs.sh" >/dev/null 2>&1 || true
    reset_sim
    printf "  %-42s " "$flow"
    if maestro --device "$SIM_UDID" test "$DIR/$flow.yaml" > "/tmp/maestro-$flow.log" 2>&1; then
      echo "✅"; sec_pass=$((sec_pass+1))
    else
      echo "❌ /tmp/maestro-$flow.log"; sec_fail=$((sec_fail+1))
      FAILED_FLOWS="$FAILED_FLOWS $sec:$flow"
    fi
  done
  TOTAL_PASS=$((TOTAL_PASS+sec_pass)); TOTAL_FAIL=$((TOTAL_FAIL+sec_fail))
  SECTION_REPORT="$SECTION_REPORT\nsection $sec: $sec_pass pass / $sec_fail fail"
done

echo ""
echo "━━━ Summary ━━━"
printf "%b\n" "$SECTION_REPORT" | sed 's/^/  /'
echo "  ─────────────────────"
printf "  total      %d pass / %d fail\n" "$TOTAL_PASS" "$TOTAL_FAIL"
if [ -n "$FAILED_FLOWS" ]; then
  echo ""; echo "Failed flows:"
  for f in $FAILED_FLOWS; do echo "  $f"; done
  exit 1
fi
exit 0
