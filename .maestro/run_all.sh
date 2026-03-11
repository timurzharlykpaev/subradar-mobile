#!/bin/bash
set -e
echo "🧪 Running Maestro E2E tests..."

PASS=0
FAIL=0
SKIPPED=0

for flow in "$(dirname "$0")"/*.yaml; do
  echo "▶ Running $flow"
  if maestro test "$flow" --format junit --output "/tmp/maestro-$(basename "$flow" .yaml).xml" 2>&1; then
    echo "✅ PASS: $flow"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL: $flow"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: ✅ $PASS passed  ❌ $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
exit $FAIL
