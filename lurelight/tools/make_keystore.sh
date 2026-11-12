#!/usr/bin/env bash
# Create the release (upload) keystore for Google Play. Run ONCE, then back up the two files it writes:
# lose them and you can only update the app by asking Google to reset the upload key.
# Never commit them: *.keystore and build/ are git-ignored.
# Usage: tools/make_keystore.sh [output dir]        (default: build/signing)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-build/signing}"
mkdir -p "$OUT"
if [ -f "$OUT/lurelight-release.keystore" ]; then echo "$OUT/lurelight-release.keystore already exists - not overwriting."; exit 1; fi
PASS="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
keytool -genkeypair -keystore "$OUT/lurelight-release.keystore" -storetype PKCS12 -storepass "$PASS" -keypass "$PASS" \
  -alias lurelight -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Lurelight, O=Lurelight, C=US" 2>/dev/null
cat > "$OUT/keystore-info.txt" <<INFO
Lurelight release (upload) keystore
file:      lurelight-release.keystore
alias:     lurelight
password:  $PASS      (same for the keystore and the key)

Keep this file and the keystore together, somewhere safe and backed up (password manager, cloud drive).
Every update of the app on Google Play must be signed with this key.
To build:  KEYSTORE=/path/lurelight-release.keystore KEYSTORE_PASS='$PASS' tools/build_release.sh
INFO
echo "Wrote $OUT/lurelight-release.keystore and $OUT/keystore-info.txt - back both up now."
