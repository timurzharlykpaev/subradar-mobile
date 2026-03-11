#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ""
echo "╔══════════════════════════════════╗"
echo "║  SubRadar Mobile Test Suite      ║"
echo "╚══════════════════════════════════╝"
echo ""

# Check maestro
if ! command -v maestro &>/dev/null; then
  echo "⚠️  Maestro not installed."
  echo "   Install: curl -Ls https://get.maestro.mobile.dev | bash"
  exit 1
fi

# Check simulator/device
if ! maestro hierarchy 2>/dev/null | grep -q "io.subradar.mobile"; then
  echo "⚠️  SubRadar app not running on any device/simulator"
  echo "   Launch app first, then run this script"
  exit 1
fi

.maestro/run_all.sh
