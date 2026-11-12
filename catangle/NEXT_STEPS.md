# Next steps

## Needs you (cannot be done from here)

| # | Step | Cost | Notes |
|---|---|---|---|
| 1 | Install the debug APK on an Android phone and play 15 minutes | Free | Build with `./gradlew assembleDebug`; file is `android/app/build/outputs/apk/debug/app-debug.apk`. Check: test ads appear, back button, sound, save survives closing the app. |
| 2 | Decide the package name | Free | Currently `com.catangle.game`. It is permanent once uploaded. Change `applicationId` and `namespace` in `android/app/build.gradle` and the Java package if you want your studio name in it. |
| 3 | Check the name "Catangle" for trademarks and on Google Play | Free | My web search found no game with this name; that is not a legal clearance. |
| 4 | Google Play developer account | $25 one-time | If you already have one from your earlier games, reuse it. |
| 5 | AdMob account and three ids (app, rewarded, interstitial) | Free | Put them in `android/ads.properties` (copy the `.example`). Add `app-ads.txt` to your website. |
| 6 | Create the upload signing key | Free | Copy `keystore.properties.example` and fill it in. Back the key up; losing it is painful. |
| 7 | Host the privacy policy and put its URL in `web/js/data.js` | Free | Draft in `docs/store/privacy-policy.md`. Fill in your name and contact email. |
| 8 | Create four in-app products in Play Console | Free | Ids: `remove_ads`, `fish_small`, `fish_medium`, `fish_large`. Prices in `GAME_DESIGN.md`. |
| 9 | Closed test: 12 testers for 14 days | Free | Required for personal accounts created after November 2023. Start early; it is the longest wait. |
| 10 | Fill in data safety, content rating and ads declarations | Free | The app collects the advertising id through AdMob and purchase history through Play. |

## Decisions I need from you

1. **Analytics and crash reporting.** I recommend Firebase Analytics and Crashlytics (free). Without them you cannot see retention, which the whole plan depends on. Not added because it is a third-party service.
2. **Ads and billing libraries.** They are integrated with test ids only. Say so if you want either removed.
3. **Where the code lives.** It is in `games/catangle/` inside the `animation-studio` repo because that was the only repo available to the session. A separate repo would be cleaner.

## After the first on-device test

1. Fix whatever the device test finds (the native ad and billing code has never run).
2. Add analytics events: level start, win, fail, ad shown, purchase.
3. Soft-launch in one or two smaller English-speaking countries and read day-1 and day-7 retention.
4. Targets before wider launch: day-1 at 30% or better, day-7 at 10% or better. Below that, improve the game before marketing it.
5. Post short-form clips three to five times a week (see `marketing/SHORT_FORM_PLAYBOOK.md`).

## Content roadmap (only if retention holds)

- Weekly event boards with a limited coat.
- New cat types: kittens that follow a parent, a cat in a box that hides its direction.
- Background music and more room themes.
- iOS build from the same web code.
