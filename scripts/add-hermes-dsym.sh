#!/usr/bin/env bash
#
# Adds the Hermes dSYM to an Xcode archive before uploading to App Store Connect.
#
# The hermes-engine pod only downloads the stripped hermes.xcframework; React Native
# ships the debug symbols as a separate Maven artifact that CocoaPods never fetches,
# so every archive triggers:
#   "The archive did not include a dSYM for the hermes.framework with the UUIDs [...]"
#
# Usage:
#   ./scripts/add-hermes-dsym.sh                 # newest archive
#   ./scripts/add-hermes-dsym.sh /path/to.xcarchive
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_DIR="$HOME/Library/Caches/bittersweet-hermes-dsym"

RN_VERSION="$(node -p "require('$REPO_ROOT/node_modules/react-native/package.json').version")"
TARBALL_URL="https://repo1.maven.org/maven2/com/facebook/react/react-native-artifacts/$RN_VERSION/react-native-artifacts-$RN_VERSION-hermes-framework-dSYM-release.tar.gz"
TARBALL="$CACHE_DIR/hermes-framework-dSYM-release-$RN_VERSION.tar.gz"
DSYM="$CACHE_DIR/$RN_VERSION/iphoneos/hermes.framework.dSYM"

ARCHIVE="${1:-$(ls -dt "$HOME"/Library/Developer/Xcode/Archives/*/*.xcarchive 2>/dev/null | head -1)}"
if [ -z "$ARCHIVE" ] || [ ! -d "$ARCHIVE" ]; then
  echo "error: no .xcarchive found (pass one as an argument)" >&2
  exit 1
fi
echo "Archive: $ARCHIVE"

if [ ! -d "$DSYM" ]; then
  mkdir -p "$CACHE_DIR/$RN_VERSION"
  if [ ! -f "$TARBALL" ]; then
    echo "Downloading Hermes dSYMs for React Native $RN_VERSION (~280 MB, cached)..."
    curl -fL --progress-bar -o "$TARBALL.partial" "$TARBALL_URL"
    mv "$TARBALL.partial" "$TARBALL"
  fi
  tar xzf "$TARBALL" -C "$CACHE_DIR/$RN_VERSION" ./iphoneos
fi

# Sanity check: the dSYM must match the hermes binary that was actually archived.
ARCHIVED_HERMES="$(find "$ARCHIVE/Products" -name hermes -path "*/hermes.framework/*" -type f | head -1)"
if [ -n "$ARCHIVED_HERMES" ]; then
  BINARY_UUID="$(dwarfdump --uuid "$ARCHIVED_HERMES" | awk '{print $2}' | head -1)"
  DSYM_UUID="$(dwarfdump --uuid "$DSYM" | awk '{print $2}' | head -1)"
  if [ "$BINARY_UUID" != "$DSYM_UUID" ]; then
    echo "error: UUID mismatch — archive has $BINARY_UUID, dSYM is $DSYM_UUID" >&2
    echo "       (React Native version changed? delete $CACHE_DIR and retry)" >&2
    exit 1
  fi
  echo "UUID verified: $DSYM_UUID"
fi

rm -rf "$ARCHIVE/dSYMs/hermes.framework.dSYM"
cp -R "$DSYM" "$ARCHIVE/dSYMs/"
echo "Added hermes.framework.dSYM — re-open Organizer and upload."
