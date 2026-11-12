# Release checklist

The game is feature-complete and the debug APK is playable. These steps need accounts, money or a physical device, so they
are yours to do.

## Must do before publishing

1. **Play on real phones.** This build was tested in a headless Chromium at phone sizes and compiled for Android, but it
   was not run on an Android device or emulator (none was available). Check: touch feel, audio after backgrounding,
   notch and gesture-bar spacing, the back button, and battery use over a 30-minute session.
2. **Check the name.** Search Google Play and trademark databases for "Emberhold". The name was not cleared.
3. **AdMob.** Create an app and one rewarded unit, then replace the two Google test IDs in `android/app/build.gradle`
   (`admobAppId`, `REWARDED_UNIT`). Set up the GDPR consent message in AdMob's Privacy & messaging tab (the app already
   calls the consent SDK).
4. **Play Console products.** Create six in-app products with exactly these IDs: `keeper_pack`, `starter_pack`, `gems_1`,
   `gems_2`, `gems_3`, `gems_4`. Test purchases, a cancelled purchase and "restore purchases" with a licence-test account.
   The billing code compiles against Billing Library 8 but has never talked to the real store.
5. **Privacy policy.** Host one (ads and purchases make it mandatory) and put its address in `web/js/ui.js`
   (`EH.PRIVACY_URL`, currently a placeholder). Fill in the Data safety form: advertising ID collected by AdMob.
6. **Signing.** Create an upload keystore and add the four `EMBERHOLD_*` properties to `~/.gradle/gradle.properties`,
   then build the bundle:

```bash
cd android && gradle bundleRelease
```

7. **Store listing.** Text is in `store/listing.md`; icon, feature graphic and five screenshots are in `store/`.
   Content rating questionnaire: fantasy violence, no gambling, in-app purchases, ads.

## Should do

- Soft-launch in one or two small English-speaking markets and read D1/D7 retention and rewarded-views-per-player before
  spending on anything.
- Add crash reporting (Firebase Crashlytics) and basic analytics events (run_end with wave, ad_view by placement,
  purchase). None is included, so the build collects no analytics today.
- Purchases are validated on the device only. If fraud appears, add server-side receipt validation.
- The save lives in WebView storage and is covered by Android device backup. A cloud save is on the roadmap.
