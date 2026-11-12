#!/usr/bin/env bash
# One-time setup of everything needed to build the Android APK from the command line on Linux:
# Godot 4.7, its Android and web export templates, the Android SDK and a debug signing key.
# Needs: curl, unzip, a JDK 17+ (java, keytool). Downloads about 1.6 GB.
# Usage: tools/setup_toolchain.sh [install dir]      (default: ~/.local/lurelight-toolchain)
set -euo pipefail
T="${1:-$HOME/.local/lurelight-toolchain}"
V=4.7-stable
VDIR=4.7.stable
mkdir -p "$T" && cd "$T"

if [ ! -x "Godot_v${V}_linux.x86_64" ]; then
  curl -fL -o godot.zip "https://github.com/godotengine/godot/releases/download/$V/Godot_v${V}_linux.x86_64.zip"
  unzip -oq godot.zip && rm godot.zip
fi

TPL="$HOME/.local/share/godot/export_templates/$VDIR"
if [ ! -f "$TPL/android_debug.apk" ] || [ ! -f "$TPL/web_nothreads_release.zip" ]; then
  curl -fL -o templates.tpz "https://github.com/godotengine/godot/releases/download/$V/Godot_v${V}_export_templates.tpz"
  unzip -oq templates.tpz -d tpl && mkdir -p "$TPL"
  cp tpl/templates/android_* tpl/templates/web_nothreads_* tpl/templates/version.txt "$TPL/"
  rm -rf tpl templates.tpz
fi

if [ ! -d sdk/platform-tools ]; then
  curl -fL -o clt.zip https://dl.google.com/android/repository/commandlinetools-linux-16111833_latest.zip
  mkdir -p sdk/cmdline-tools && unzip -oq clt.zip -d sdk/cmdline-tools
  mv sdk/cmdline-tools/cmdline-tools sdk/cmdline-tools/latest && rm clt.zip
  yes | sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root="$T/sdk" --licenses >/dev/null 2>&1 || true
  sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root="$T/sdk" "platform-tools" "build-tools;35.0.1" "platforms;android-35"
fi

if [ ! -f debug.keystore ]; then
  keytool -genkeypair -keystore debug.keystore -storepass android -keypass android -alias androiddebugkey \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
fi

CFG="$HOME/.config/godot/editor_settings-4.7.tres"
JAVA_HOME_GUESS="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")"
if [ ! -f "$CFG" ]; then
  mkdir -p "$(dirname "$CFG")"
  cat > "$CFG" <<CFGEOF
[gd_resource type="EditorSettings" format=3]
[resource]
export/android/android_sdk_path = "$T/sdk"
export/android/java_sdk_path = "$JAVA_HOME_GUESS"
export/android/debug_keystore = "$T/debug.keystore"
export/android/debug_keystore_user = "androiddebugkey"
export/android/debug_keystore_pass = "android"
CFGEOF
else
  echo "Godot editor settings already exist at $CFG - not overwriting."
  echo "In Godot: Editor Settings > Export > Android, set SDK path to $T/sdk and the debug keystore to $T/debug.keystore"
fi
echo "Toolchain ready. Build with: GODOT=$T/Godot_v${V}_linux.x86_64 tools/build_apk.sh"
