#!/usr/bin/env bash
#
# Preflight for `eas update`. Both OTA failure modes are silent — a mismatched
# runtime version publishes successfully and simply reaches nobody — so this
# runs before every publish rather than on demand.
#
# It answers one question: would an update published right now actually be
# served to the build I last archived on this channel?
#
# Usage: scripts/ota-preflight.sh <channel>

set -euo pipefail

CHANNEL="${1:-}"
if [ -z "$CHANNEL" ]; then
  echo "usage: scripts/ota-preflight.sh <channel>" >&2
  exit 2
fi

# The channel comes from .update-channel (see app.config.js) — never an env var,
# because the Xcode build phase that stamps the fingerprint can't see your shell.
SELECTED=$(cat .update-channel 2>/dev/null || echo "production")
if [ "$SELECTED" != "$CHANNEL" ]; then
  echo "✗ .update-channel says '$SELECTED' but publishing to '$CHANNEL'" >&2
  echo "  run: echo $CHANNEL > .update-channel" >&2
  exit 1
fi

# The runtime version an update published now would carry.
CURRENT=$(npx expo-updates runtimeversion:resolve --platform ios 2>/dev/null \
  | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).runtimeVersion')

if [ -z "$CURRENT" ]; then
  echo "✗ could not resolve a runtime version for channel '$CHANNEL'" >&2
  exit 1
fi

# Newest archive built on this channel. Each archived .app carries both the
# channel (Expo.plist) and the fingerprint it was built with (EXUpdates.bundle),
# so the shipped build is its own source of truth — no server lookup needed.
BUILT=""
BUILT_AT=""
while IFS= read -r app; do
  plist="$app/Expo.plist"
  fingerprint="$app/EXUpdates.bundle/fingerprint"
  [ -f "$plist" ] && [ -f "$fingerprint" ] || continue

  ch=$(/usr/libexec/PlistBuddy -c "Print :EXUpdatesRequestHeaders:expo-channel-name" "$plist" 2>/dev/null || true)
  [ "$ch" = "$CHANNEL" ] || continue

  BUILT=$(cat "$fingerprint")
  BUILT_AT=$(basename "$(dirname "$(dirname "$(dirname "$app")")")")
  break
done < <(ls -td "$HOME/Library/Developer/Xcode/Archives"/*/*.xcarchive/Products/Applications/*.app 2>/dev/null || true)

if [ -z "$BUILT" ]; then
  # Not proof of a mismatch — they may have distributed a build we can't see.
  echo "⚠  no local archive found on channel '$CHANNEL'; cannot verify."
  echo "   publishing anyway — runtime version: $CURRENT"
  exit 0
fi

if [ "$CURRENT" = "$BUILT" ]; then
  echo "✓ runtime version matches '$CHANNEL' build ($BUILT_AT)"
  echo "  $CURRENT"
  exit 0
fi

cat >&2 <<EOF
✗ RUNTIME VERSION MISMATCH — this update would reach nobody.

  archived build ($BUILT_AT): $BUILT
  publishing now:             $CURRENT

  Something native changed since that build (plugins/, patches/, targets/,
  a native dependency, or app config). An OTA update cannot carry it.

  Archive and ship a new build instead:
    echo $CHANNEL > .update-channel && npx expo prebuild
EOF
exit 1
