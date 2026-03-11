#!/bin/bash
set -e

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"

echo "╔══════════════════════════════════╗"
echo "║  SubRadar Mobile Test Suite      ║"
echo "╚══════════════════════════════════╝"

# Unit тесты
echo ""
echo "📦 Unit Tests (Jest)"
echo "--------------------"
npm test --silent
echo "✅ Unit tests passed"

# E2E тесты (только если есть booted симулятор)
echo ""
echo "🎭 E2E Tests (Maestro)"
echo "----------------------"

DEVICE=$(xcrun simctl list devices booted 2>/dev/null | grep "Booted" | head -1 | grep -oE "[A-F0-9-]{36}" | head -1)

if [ -z "$DEVICE" ]; then
  echo "⚠️  No booted simulator found — skipping E2E"
  echo "   Boot a simulator: xcrun simctl boot <UDID>"
  exit 0
fi

if ! command -v maestro &>/dev/null; then
  echo "⚠️  Maestro not installed — skipping E2E"
  echo "   Install: curl -Ls https://get.maestro.mobile.dev | bash"
  exit 0
fi

bash "$(dirname "$0")/../.maestro/run_all.sh"
