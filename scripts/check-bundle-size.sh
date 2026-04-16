#!/usr/bin/env bash
# check-bundle-size.sh
#
# Reminder script — run after `eas build` completes to check that the
# produced IPA / APK stays under the target size. EAS does not expose
# artifact sizes via CLI yet (as of SDK 54), so this script is a nudge
# rather than an automated check. We track the threshold here so it
# doesn't drift.
#
# Usage: ./scripts/check-bundle-size.sh
#
# Related: see docs/BUILD_PROFILES.md for the different EAS profiles.

set -euo pipefail

MAX_MB=60
PROJECT_URL="https://expo.dev/accounts/timur98_zkharlyk/projects/subradar/builds"

cat <<EOF
──────────────────────────────────────────────────────────────
 Bundle size check — reminder
──────────────────────────────────────────────────────────────
 Target:  ≤ ${MAX_MB} MB (IPA) / ≤ ${MAX_MB} MB (APK base)

 Open the latest build in EAS dashboard and check:
   ${PROJECT_URL}

 If the build exceeds the target:
   1. Inspect dependencies:  npx expo-doctor
   2. Check assets:          du -sh assets/* | sort -hr | head -20
   3. Check JS bundle:       npx expo export --platform ios --dump-sourcemap
   4. Run size-visualizer:   npx react-native-bundle-visualizer
   5. Strip unused RevenueCat entitlements if any.

 Known heavy deps (budget):
   react-native-purchases-ui   ~6 MB
   @sentry/react-native        ~2 MB
   expo-image                  ~3 MB
   @expo-google-fonts/inter    ~1.5 MB
──────────────────────────────────────────────────────────────
EOF

# If the EAS CLI ever exposes artifact size, add the automated check here
# and exit non-zero when threshold is breached. Until then this is advisory.
exit 0
