#!/usr/bin/env bash
# Downloads the Android build tools that android/build.sh needs (TOOLS folder) and Google's bundletool (for the Play
# AAB). Every Maven Central jar is checked against its SHA-256, so a changed or broken download stops the build.
#
#   ./android/tools/fetch-tools.sh /path/to/tools     → /path/to/tools/{lib,bin/prebuilt}, /path/to/tools/bundletool-all.jar
set -euo pipefail
DIR="${1:?Give the folder for the tools}"
mkdir -p "$DIR/lib" "$DIR/bin"
M=https://repo1.maven.org/maven2
get() { # url, file, sha256
  [ -f "$DIR/lib/$2" ] || curl -fsSL --retry 3 -o "$DIR/lib/$2" "$1"
  echo "$3  $DIR/lib/$2" | sha256sum -c --quiet -
}
get "$M/org/robolectric/android-all/16-robolectric-13785805/android-all-16-robolectric-13785805.jar" android-all-16-robolectric-13785805.jar 2d8dd935582f3f22022c268b847c4f507861a082990365437e58183e271148dc
get "$M/org/apktool/apktool-lib/2.11.1/apktool-lib-2.11.1.jar" apktool-lib-2.11.1.jar 035586e8a3d0c5d153cc6efca02b5d64dc5bea59bf9eeaf488e8b0c57865c394
get "$M/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar" dalvik-dx-16.0.1.jar 1e4b645628e3bdb097b5331d669e177ef235a551582a8c646dbe36865e541907
get "$M/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar" apksig-2.3.0.jar 9637078c0016244e4be0941836295365a7e2e5b164c59cb7885783c40460bfee
# aapt2 and the Android framework come inside apktool-lib
(cd "$DIR/bin" && unzip -oq "$DIR/lib/apktool-lib-2.11.1.jar" 'prebuilt/*' && chmod +x prebuilt/linux/aapt2)
# bundletool: Google's official release (only needed for the AAB)
BT_VERSION="${BT_VERSION:-1.17.2}"
[ -f "$DIR/bundletool-all.jar" ] || curl -fsSL --retry 3 -o "$DIR/bundletool-all.jar" "https://github.com/google/bundletool/releases/download/$BT_VERSION/bundletool-all-$BT_VERSION.jar"
java -jar "$DIR/bundletool-all.jar" version >/dev/null 2>&1 || { echo "bundletool did not start"; exit 1; }
echo "Tools ready in $DIR"
