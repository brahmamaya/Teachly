# Teachly on Google Play: checklist

Promise: free, no login, no payment, no ads, nothing collected. Data stays on the device.

## Done in the repo
- `PLAY=1 ./android/build.sh` builds the Play version: **no INTERNET permission, no self-updater** (Play delivers updates; downloading app files outside Play is a policy risk). Only RECORD_AUDIO remains (asked only when the teacher taps lesson recording).
- No camera, no CAMERA permission. `allowBackup=false`. Privacy policy / Terms in `src/ui/legal.ts` updated (20 Nov 2026).
- The normal build (without PLAY) still has the updater for the school APK outside Play.
- **Target SDK 36** (Android 16) is now the default in `android/build.sh`. For it the app handles back with the Android 13+ callback (apps for Android 16 no longer get `onBackPressed`; a second press within 2 s closes) and keeps the board clear of a phone's notch / camera hole (apps for Android 15+ draw under it).
- **AAB**: `android/build.sh` also makes the bundle module (`android/build/base.zip`, resources in protobuf form). With Google's bundletool it makes the signed bundle:
  ```
  PLAY=1 BUNDLETOOL=/path/bundletool-all-1.x.jar KEY=/path/upload-key.p12 KEY_PASS='…' TOOLS=/path/android-tools ./android/build.sh
  # → android/build/Teachly.aab (upload this to Play) and android/build/Teachly.apk (to try on a device)
  ```
  bundletool is a free jar from github.com/google/bundletool/releases (download it on your computer; it is not in the repo). Sign the AAB with your **upload key** and turn on **Play App Signing** in the Play Console.

## Owner must do (cannot be done from the repo)
1. **Play Console account** (one-time fee). Use an organisation/brand name (e.g. Physica) so no personal name shows. Personal accounts must show address/name and need a 14-day closed test with 12 testers before production: plan this month.
2. **Upload key + AAB**: make an upload key once (`keytool -genkeypair -keystore upload-key.p12 -storetype PKCS12 -alias teachly -keyalg RSA -keysize 2048 -validity 10000`), keep it and its password outside the repo, download bundletool, then run the command above. Use **Play App Signing**.
3. **Test on Android 16 and older**: the target-36 build was made and checked here (manifest, permissions, bundle format) but never run on a device: try back (twice to close), a phone with a notch, a tablet and a board before uploading.
4. **Privacy policy URL**: a public page with the same text as in-app (physica.in/privacy), no personal name.
5. **Data safety form**: Data collected: *No*. Data shared: *No*. Encrypted in transit: n/a. Deletion: data is only on device, uninstall deletes it.
6. **Permissions form**: RECORD_AUDIO is used for recording the teacher's lessons on device; nothing is uploaded.
7. **Content rating** questionnaire (no violence/ads/purchases/user content sharing). **Target audience**: teachers/adults 18+ (avoid "children" audience: stricter rules).
8. **Ads: No. In-app purchases: No. App access: all features open, no login.**
9. **Listing**: name, short (80 chars) and full description, 512 icon, 1024x500 feature graphic, 2-8 screenshots (phone + tablet), category Education.
10. Test the Play build on a real phone, tablet and board before upload.

## Verified here (2026-11-21)
`PLAY=1 ./android/build.sh` ran with a throw-away test key: APK built and signature-checked (v2), targetSdk 36 / minSdk 24, only RECORD_AUDIO, `enableOnBackInvokedCallback`, and `base.zip` converts back cleanly with aapt2 (valid bundle module). **Not verified**: bundletool was not available in this container (Google's server is blocked here), so `Teachly.aab` itself was not built; no device test.
