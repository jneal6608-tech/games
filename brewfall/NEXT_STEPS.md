# Next steps (in order)

## Only you can do these
1. **Play it on a real Android phone.** Install `release/brewfall-1.0.0-debug.apk`. This has not been done yet and is the single most important check (see `TESTING_REPORT.md`).
2. **Decide the package name** (`com.brewfall.game` now). It is permanent after the first upload.
3. **Check the name "Brewfall"** on Google Play and for trademarks. A web search found no game with that name; that is not a legal clearance.
4. **Create accounts and IDs** (free to create; Play developer registration has Google's one-time fee, which is your call):
   - AdMob: an app plus one rewarded and one interstitial ad unit.
   - Play Console: create the app; copy the base64 licence key (Monetisation setup); create in-app products with exactly these IDs: `moon_80`, `moon_450`, `moon_1000`, `moon_2400`, `starter_pack`, `remove_ads`.
   - Host `store/privacy-policy.html` at a public URL after filling the bracketed fields.
5. **Put the IDs in `android/keystore.properties`** (`admobAppId`, `admobRewardedId`, `admobInterstitialId`, `playLicenseKey`, `privacyUrl`) and rebuild (`TECHNICAL_NOTES.md`). Until then the builds show test ads and the store is closed.
6. **Keep the signing key safe.** The keystore and its password were sent to you in chat, not committed. Lose it before the first upload and you simply make a new one; after the first upload it is your upload key.
7. **Internal testing track:** upload the AAB, add yourself as a licence tester, and test a real purchase of each product, a cancelled purchase, Restore purchases after reinstall, a real reward video, and the consent form (use a European test setting).
8. Complete the store listing, content rating and data safety forms from `store/listing.md`.

## Development follow-ups, most valuable first
1. Fix whatever the first on-device session shows.
2. Human balance pass: order targets, charm prices, Glint pacing (`web/src/data.js`).
3. Sound pass by ear (everything is synthesised and has not been listened to).
4. Play Games Services leaderboard for the Daily Brew (free, needs Console setup).
5. Analytics (for example Firebase, free tier) to measure retention and ad/IAP funnels — adds data collection, so update the privacy policy and data safety form; wants your approval first.
6. Update libraries to Billing 9 and Ads 25 and re-test.
7. Content updates: more charms and hexes, weekly event modifiers, seasonal essence styles.
8. Localisation (all text is in `main.js` and `data.js`).
9. iOS: the web game is portable; it needs a WKWebView shell with StoreKit and the ads SDK.
