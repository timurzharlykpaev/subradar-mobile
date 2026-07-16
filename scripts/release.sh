#!/usr/bin/env bash
#
# One-command SubRadar iOS release.
#
#   scripts/release.sh patch   # 1.4.21 -> 1.4.22  (bugfix)
#   scripts/release.sh minor   # 1.4.21 -> 1.5.0   (feature)
#   scripts/release.sh major   # 1.4.21 -> 2.0.0
#   scripts/release.sh none    # no bump — reship current version
#
# Steps: bump version (package.json + app.json) → commit → push main →
# EAS cloud build (profile testflight, channel production) → auto-submit to
# TestFlight → push App Store listing (store.config.json) via the ASC API.
#
# Everything runs non-interactively with the local EAS session + ASC API key.
# NOTE: do NOT pass --json to `eas build` — it makes the CLI return before the
# build finishes and hides progress (the auto-submit still runs server-side).
set -euo pipefail
cd "$(dirname "$0")/.."

BUMP="${1:-patch}"
EAS="npx eas-cli@16.3.3"

if [ "$BUMP" != "none" ]; then
  echo "▶ Bumping version ($BUMP)…"
  npm run "version:$BUMP"
  VERSION=$(node -p "require('./package.json').version")
  git add package.json app.json
  git commit -m "chore: bump version to $VERSION"
else
  VERSION=$(node -p "require('./package.json').version")
  echo "▶ Reshipping current version $VERSION (no bump)"
fi

echo "▶ Pushing main…"
git push origin main

echo "▶ Building $VERSION on EAS + auto-submitting to TestFlight (~20-25 min)…"
$EAS build --platform ios --profile testflight --auto-submit --non-interactive

echo "▶ Syncing App Store listing (store.config.json → ASC)…"
node scripts/asc-metadata.js push || echo "⚠ metadata push skipped/failed (version may not be editable yet) — non-fatal"

echo "✅ Release $VERSION done. Track: https://expo.dev/accounts/timur98_zkharlyk/projects/subradar/builds"
echo "   TestFlight processing takes ~10 min. For public App Store: create the version in ASC + Submit for Review."
