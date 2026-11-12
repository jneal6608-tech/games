#!/usr/bin/env bash
# Build the signed release: an .aab for Google Play and an .apk for installing by hand.
# Usage: GODOT=/path/to/godot KEYSTORE=/path/lurelight-release.keystore KEYSTORE_PASS=... tools/build_release.sh
# Needs tools/setup_toolchain.sh to have been run. First build downloads Gradle and the Android libraries.
set -euo pipefail
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
: "${KEYSTORE:?set KEYSTORE to the release keystore (see tools/make_keystore.sh)}"
: "${KEYSTORE_PASS:?set KEYSTORE_PASS}"
export GODOT_ANDROID_KEYSTORE_RELEASE_PATH="$(readlink -f "$KEYSTORE")"
export GODOT_ANDROID_KEYSTORE_RELEASE_USER="${KEYSTORE_ALIAS:-lurelight}"
export GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD="$KEYSTORE_PASS"
tools/install_android_template.sh
mkdir -p build
"$GODOT" --headless --path . --import >/dev/null 2>&1 || true
for target in "Android AAB:build/lurelight-release.aab" "Android:build/lurelight-release.apk"; do
  rm -f "${target#*:}"
  for try in 1 2 3 4; do  # Maven Central sometimes answers 429 on the first download; what did arrive is cached
    "$GODOT" --headless --path . --export-release "${target%%:*}" "${target#*:}" > build/export.log 2>&1 || true
    [ -f "${target#*:}" ] && break
    echo "export failed (try $try), retrying in 30 s:"; grep -E "What went wrong|Could not|error:" -A2 build/export.log | head -8 || true
    sleep 30
  done
  [ -f "${target#*:}" ] || { echo "FAILED: see build/export.log"; exit 1; }
done
ls -la build/lurelight-release.aab build/lurelight-release.apk
