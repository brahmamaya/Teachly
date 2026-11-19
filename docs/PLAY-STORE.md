# Teachly on Google Play: checklist

Promise: free, no login, no payment, no ads, nothing collected. Data stays on the device.

## Done in the repo
- `PLAY=1 ./android/build.sh` builds the Play version: **no INTERNET permission, no self-updater** (Play delivers updates; downloading app files outside Play is a policy risk). Only RECORD_AUDIO remains (asked only when the teacher taps lesson recording).
- No camera, no CAMERA permission. `allowBackup=false`. Privacy policy / Terms in `src/ui/legal.ts` updated (20 Nov 2026).
- The normal build (without PLAY) still has the updater for the school APK outside Play.

## Owner must do (cannot be done from the repo)
1. **Play Console account** (one-time fee). Use an organisation/brand name (e.g. Physica) so no personal name shows. Personal accounts must show address/name and need a 14-day closed test with 12 testers before production: plan this month.
2. **AAB**: Play needs `.aab`, build.sh makes an APK. Build the AAB with bundletool (or Android Studio) from the same sources. Use **Play App Signing**; keep the upload key outside the repo.
3. **Target SDK**: Play expects the newest level (36 from Aug 2026). Build with `TARGET_SDK=36` and test on Android 16 (edge-to-edge changes). Not tested here (no device).
4. **Privacy policy URL**: a public page with the same text as in-app (physica.in/privacy), no personal name.
5. **Data safety form**: Data collected: *No*. Data shared: *No*. Encrypted in transit: n/a. Deletion: data is only on device, uninstall deletes it.
6. **Permissions form**: RECORD_AUDIO is used for recording the teacher's lessons on device; nothing is uploaded.
7. **Content rating** questionnaire (no violence/ads/purchases/user content sharing). **Target audience**: teachers/adults 18+ (avoid "children" audience: stricter rules).
8. **Ads: No. In-app purchases: No. App access: all features open, no login.**
9. **Listing**: name, short (80 chars) and full description, 512 icon, 1024x500 feature graphic, 2-8 screenshots (phone + tablet), category Education.
10. Test the Play build on a real phone, tablet and board before upload.

## Not verified here
No Android SDK or device in this container: the Play build script change was not run.
