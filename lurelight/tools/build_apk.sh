#!/usr/bin/env bash
# Build the debug APK (installable on any Android 7+ phone for testing).
# Usage: GODOT=/path/to/godot tools/build_apk.sh      Output: build/lurelight-debug.apk
set -euo pipefail
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
mkdir -p build
tools/install_android_template.sh
"$GODOT" --headless --path . --import >/dev/null 2>&1 || true
"$GODOT" --headless --path . --export-debug Android build/lurelight-debug.apk 2>&1 | grep -vE "ADDING|JAVA_TOOL_OPTIONS|daemon at tcp" || true
ls -la build/lurelight-debug.apk
