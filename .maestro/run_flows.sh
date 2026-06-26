#!/usr/bin/env bash
# Re-run an arbitrary subset of flows (used by the fix→rerun loop).
# Usage: ./run_flows.sh 01_onboarding_language 12_sub_sort ...
# Per-flow clean sim state, same as run_all.sh. Logs to /tmp/maestro-<flow>.log.
set -u
export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}
export PATH="/opt/homebrew/opt/openjdk@17/bin:$HOME/.maestro/bin:$PATH"
export MAESTRO_CLI_NO_ANALYTICS=1
DIR="$(cd "$(dirname "$0")" && pwd)"; cd "$DIR"
SIM_UDID="${SIM_UDID:-$(xcrun simctl list devices booted | grep -oE '[A-F0-9]{8}-([A-F0-9]{4}-){3}[A-F0-9]{12}' | head -1)}"
APP_PATH="${APP_PATH:-/tmp/subradar-build/Build/Products/Debug-iphonesimulator/SubRadar.app}"
BUNDLE_ID="com.goalin.subradar"
PASS=0; FAIL=0; FAILED=""
for flow in "$@"; do
  [ -f "$DIR/$flow.yaml" ] || { echo "  ⚠️  $flow.yaml missing"; continue; }
  # Clear review's backend subscriptions so add-flows never hit the free limit
  # (clearState only wipes local state; the backend accumulates across flows).
  "$DIR/reset_review_subs.sh" >/dev/null 2>&1 || true
  xcrun simctl terminate "$SIM_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl uninstall "$SIM_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl keychain "$SIM_UDID" reset >/dev/null 2>&1 || true
  xcrun simctl install "$SIM_UDID" "$APP_PATH" >/dev/null 2>&1
  printf "  %-44s " "$flow"
  if maestro --device "$SIM_UDID" test "$DIR/$flow.yaml" > "/tmp/maestro-$flow.log" 2>&1; then
    echo "✅"; PASS=$((PASS+1))
  else
    echo "❌"; FAIL=$((FAIL+1)); FAILED="$FAILED $flow"
  fi
done
echo "── $PASS pass / $FAIL fail ──"
[ -n "$FAILED" ] && echo "FAILED:$FAILED"
exit $([ $FAIL -eq 0 ] && echo 0 || echo 1)
