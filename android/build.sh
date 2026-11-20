#!/usr/bin/env bash
# Builds Teachly.apk (the Android app for digital boards).
#
#   TOOLS=/path/to/android-tools ./android/build.sh
#
# TOOLS must contain lib/ (apktool-lib, dalvik-dx, android-all, apksig jars from
# Maven Central) and bin/prebuilt/{linux/aapt2,android-framework.jar}
# (unpacked from apktool-lib).
#
# The signing key is NOT in this repository. Pass it in:
#   KEY=/path/to/teachly-release.p12 KEY_PASS='…' TOOLS=… ./android/build.sh
# Always use the same key, so new versions install over old ones.
#
# PLAY=1 builds the Google Play version: no INTERNET permission, no self-updater
# (Google Play delivers updates), so the app cannot send or fetch anything.
# TARGET_SDK defaults to 36 (Android 16, what Google Play asks for).
#
# AAB (Google Play wants an Android App Bundle, not an APK): also give BUNDLETOOL, the path to Google's
# bundletool-all-*.jar (free download: github.com/google/bundletool/releases). Then android/build/Teachly.aab is
# built next to the APK and signed with the same key (use it as the Play "upload key"; Play App Signing re-signs it):
#   PLAY=1 BUNDLETOOL=/path/bundletool-all.jar KEY=… KEY_PASS=… TOOLS=… ./android/build.sh
# Without BUNDLETOOL the bundle's module (android/build/base.zip) is still made, ready for bundletool.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
: "${TOOLS:?Set TOOLS to the android tools folder}"
VERSION_NAME="${VERSION_NAME:-$(node -p "require('$ROOT/package.json').version")}"
VERSION_CODE="${VERSION_CODE:-$(date +%y%m%d%H)}"
PLAY="${PLAY:-0}"
TARGET_SDK="${TARGET_SDK:-36}"
KEY="${KEY:?Set KEY to the signing key file (teachly-release.p12)}"
KEY_PASS="${KEY_PASS:?Set KEY_PASS to the signing key password}"
OUT="$HERE/build"
AAPT2="$TOOLS/bin/prebuilt/linux/aapt2"
FRAMEWORK="$TOOLS/bin/prebuilt/android-framework.jar"
ANDROID_JAR="$(ls "$TOOLS"/lib/android-all-*.jar | head -1)"
DX="$(ls "$TOOLS"/lib/dalvik-dx-*.jar | head -1)"
APKSIG="$(ls "$TOOLS"/lib/apksig-*.jar | head -1)"

rm -rf "$OUT" && mkdir -p "$OUT/assets/www" "$OUT/classes" "$OUT/tools"

# 1. The web app. Split into files so the board only loads what is used
# (PDF, PowerPoint, graph code load on demand) — much faster start-up.
(cd "$ROOT" && npx vite build >/dev/null)
cp -r "$ROOT/dist/." "$OUT/assets/www/"
rm -f "$OUT/assets/www/Teachly.html" "$OUT/assets/www/Teachly.apk" "$OUT/assets/www/"*.mp4 "$OUT/assets/www/sw.js"

# 2. Resources + manifest.
"$AAPT2" compile --dir "$HERE/res" -o "$OUT/res.zip"
MANIFEST="$HERE/AndroidManifest.xml"
if [ "$PLAY" = 1 ]; then
  MANIFEST="$OUT/AndroidManifest.xml"
  grep -v 'android.permission.INTERNET' "$HERE/AndroidManifest.xml" > "$MANIFEST"
fi
"$AAPT2" link -I "$FRAMEWORK" --manifest "$MANIFEST" \
  --min-sdk-version 24 --target-sdk-version "$TARGET_SDK" \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -A "$OUT/assets" -o "$OUT/base.apk" "$OUT/res.zip"

# 3. Code.
mkdir -p "$OUT/gen/com/physica/teachly"
echo "package com.physica.teachly; final class Flavor { static final boolean PLAY = $([ "$PLAY" = 1 ] && echo true || echo false); private Flavor() {} }" > "$OUT/gen/com/physica/teachly/Flavor.java"
javac -nowarn --release 8 -cp "$ANDROID_JAR" -d "$OUT/classes" $(find "$HERE/src" "$OUT/gen" -name '*.java') 2>&1 | grep -v "^warning\|^Note" || true
java -cp "$DX" com.android.dx.command.Main --dex --min-sdk-version=24 --output="$OUT/classes.dex" "$OUT/classes"

# 4. Pack and sign (APK signature v2, for Android 7.0 and newer).
python3 "$HERE/tools/pack.py" "$OUT/base.apk" "$OUT/classes.dex" "$OUT/unsigned.apk"
javac -nowarn -cp "$APKSIG" -d "$OUT/tools" "$HERE/tools/SignApk.java" "$HERE/tools/VerifyApk.java"
JOPTS="--add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED"
java $JOPTS -cp "$APKSIG:$OUT/tools" SignApk "$OUT/unsigned.apk" "$OUT/Teachly.apk" "$KEY" "$KEY_PASS"
java $JOPTS -cp "$APKSIG:$OUT/tools" VerifyApk "$OUT/Teachly.apk"
echo "Built $OUT/Teachly.apk ($VERSION_NAME / $VERSION_CODE)"

# 5. App bundle for Google Play: the same app with resources in bundle (protobuf) form, packed as one "base" module
# (manifest/, dex/, res/, assets/, resources.pb), then turned into Teachly.aab by bundletool and signed.
"$AAPT2" link --proto-format -I "$FRAMEWORK" --manifest "$MANIFEST" \
  --min-sdk-version 24 --target-sdk-version "$TARGET_SDK" \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -A "$OUT/assets" -o "$OUT/proto.apk" "$OUT/res.zip"
python3 "$HERE/tools/module.py" "$OUT/proto.apk" "$OUT/classes.dex" "$OUT/base.zip"
if [ -n "${BUNDLETOOL:-}" ]; then
  rm -f "$OUT/Teachly.aab"
  java -jar "$BUNDLETOOL" build-bundle --modules="$OUT/base.zip" --output="$OUT/Teachly.aab"
  ALIAS="$(keytool -list -keystore "$KEY" -storetype PKCS12 -storepass "$KEY_PASS" 2>/dev/null | grep -i 'PrivateKeyEntry' | head -1 | cut -d, -f1)"
  jarsigner -keystore "$KEY" -storetype PKCS12 -storepass "$KEY_PASS" -sigalg SHA256withRSA -digestalg SHA-256 "$OUT/Teachly.aab" "$ALIAS" >/dev/null
  jarsigner -verify "$OUT/Teachly.aab" >/dev/null && echo "Built $OUT/Teachly.aab (signed, for Google Play)"
else
  echo "Made $OUT/base.zip (the bundle's module). Give BUNDLETOOL=/path/bundletool-all.jar to get Teachly.aab."
fi
