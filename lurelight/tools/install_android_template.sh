#!/usr/bin/env bash
# Unpack Godot's Android build template into android/build (git-ignored). The ad and billing plugins need a
# Gradle build, and Gradle builds need this template. Safe to run again; it only unpacks when missing or outdated.
set -euo pipefail
cd "$(dirname "$0")/.."
TPL="${GODOT_TEMPLATES:-$HOME/.local/share/godot/export_templates/4.7.stable}"
[ -f "$TPL/android_source.zip" ] || { echo "Missing $TPL/android_source.zip - run tools/setup_toolchain.sh"; exit 1; }
if [ ! -f android/.build_version ] || ! cmp -s android/.build_version "$TPL/version.txt"; then
  rm -rf android/build && mkdir -p android/build
  unzip -oq "$TPL/android_source.zip" -d android/build
  touch android/build/.gdignore
  cp "$TPL/version.txt" android/.build_version
  echo "Installed the Android build template ($(cat android/.build_version))."
fi
