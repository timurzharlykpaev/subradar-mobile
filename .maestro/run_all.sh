#!/bin/bash

# Java 17 + Maestro PATH
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export PATH="/opt/homebrew/opt/openjdk@17/bin:$HOME/.maestro/bin:$PATH"
export MAESTRO_CLI_NO_ANALYTICS=1

if ! command -v maestro &>/dev/null; then
  echo "❌ Maestro not found. Install: curl -Ls https://get.maestro.mobile.dev | bash"
  exit 1
fi

echo "🧪 SubRadar E2E Tests (Maestro)"
echo "================================"

PASS=0
FAIL=0
ERRORS=()
DIR="$(cd "$(dirname "$0")" && pwd)"

# Автодетект booted симулятора
DEVICE=$(xcrun simctl list devices booted 2>/dev/null | grep "Booted" | head -1 | grep -oE "[A-F0-9-]{36}" | head -1)
if [ -z "$DEVICE" ]; then
  echo "❌ No booted simulator. Run: xcrun simctl boot <UDID>"
  exit 1
fi
echo "📱 Device: $DEVICE"

# Убеждаемся что приложение установлено
APP=$(find /tmp/subradar-build -name "SubRadar.app" -not -path "*/PlugIns/*" 2>/dev/null | head -1)
if [ -n "$APP" ]; then
  xcrun simctl install "$DEVICE" "$APP" 2>/dev/null && echo "📦 App installed"
fi

ORDERED=(
  "00_setup_auth"
  "04_add_subscription_manual"
  "04c_edit_subscription"
  "04d_delete_subscription"
  "04e_subscription_detail"
  "05_subscriptions_list"
  "06_analytics"
  "07_settings_theme"
  "08_paywall_limit"
  "09_cards_flow"
  "10_reports_flow"
  "11_subscription_search"
  "12_subscription_filter"
  "13_analytics_forecast"
  "14_analytics_categories"
  "15_settings_currency"
  "16_settings_language"
  "17_settings_notifications"
  "18_profile_edit"
  "19_paywall_upgrade"
  "20_dashboard_sanity"
  "21_logout"
  "23_settings_team_plan"
  "24_paywall_flow"
  "25_ai_wizard_plans"
  "26_settings_restore"
)

for name in "${ORDERED[@]}"; do
  flow="$DIR/${name}.yaml"
  [ -f "$flow" ] || continue

  echo -n "▶ $name ... "

  # Пауза между тестами чтобы Maestro driver восстановился
  sleep 2

  maestro --device "$DEVICE" test "$flow" --debug-output /tmp/maestro-debug
  CODE=$?

  if [ $CODE -eq 0 ]; then
    echo "✅"
    PASS=$((PASS+1))
  else
    echo "❌"
    FAIL=$((FAIL+1))
    ERRORS+=("$name")
    # Пауза после ошибки — даём driver время восстановиться
    sleep 3
  fi
done

echo ""
echo "================================"
echo "Results: ✅ $PASS passed  ❌ $FAIL failed"
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "Failed flows:"
  for e in "${ERRORS[@]}"; do echo "  - $e"; done
  exit 1
fi
exit 0
