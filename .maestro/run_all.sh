#!/bin/bash
echo "🧪 SubRadar E2E Tests (Maestro)"
echo "================================"

PASS=0
FAIL=0
ERRORS=()

for flow in "$(dirname "$0")"/*.yaml; do
  name=$(basename "$flow" .yaml)
  echo -n "▶ $name ... "
  if maestro test "$flow" --format junit --output "/tmp/maestro-${name}.xml" 2>/dev/null; then
    echo "✅"
    PASS=$((PASS+1))
  else
    echo "❌"
    FAIL=$((FAIL+1))
    ERRORS+=("$name")
  fi
done

echo ""
echo "Results: ✅ $PASS passed  ❌ $FAIL failed"
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "Failed flows:"
  for e in "${ERRORS[@]}"; do echo "  - $e"; done
fi
exit $FAIL
