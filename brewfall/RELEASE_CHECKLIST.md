# Brewfall — Release Checklist

Status legend: `[x]` verified in this repo · `[ ]` not done / needs you · `[~]` partly done or done but unverified.
Last audit: 12 Nov 2026. Platform: Android (Kotlin WebView shell, esbuild bundle of `web/src` into `android/app/src/main/assets/www`).
See also `TESTING_REPORT.md`, `MONETIZATION_PLAN.md`, `NEXT_STEPS.md`.

## A. App store assets

- [x] App icon 512×512 — `store/icon-512.png`; adaptive vector launcher icon
- [x] Title — **Brewfall: Merge Roguelike** (25/30)
- [x] Short + full description — `store/listing.md`
- [x] Feature graphic 1024×500 — `store/feature-graphic-1024x500.png`
- [x] Phone screenshots (8) — `store/screenshots/` (regenerate with `tools/store-assets.mjs`)
- [ ] Tablet screenshots — optional
- [x] Consistent branding — purple night palette, gold "Brewfall" wordmark, same orb art on icon, hero and gameplay

## B. Technical release requirements

- [x] Production build — `node tools/build-web.mjs` (minified bundle) then Gradle `bundleRelease`; R8 enabled
- [ ] **Application id final** — `com.brewfall.game` (override with `applicationId=` in `android/keystore.properties` before first upload)
- [x] No debug UI in production — simulated ads/store only with `?dev=1`; in a plain browser ads and purchases are unavailable
- [x] No secrets committed — AdMob ids, licence key, privacy URL and signing come from git-ignored `android/keystore.properties`
- [ ] **Real AdMob ids + Play licence key** in `android/keystore.properties` (falls back to Google test ids; store stays closed without the key)
- [x] Asset paths — `WebViewAssetLoader`; everything bundled, works offline
- [x] Error handling — global error handler saves; corrupt save → backup → native device copy → fresh start (tested)
- [x] WebView renderer crash recovery (`onRenderProcessGone` → recreate)
- [x] Permissions — INTERNET, ACCESS_NETWORK_STATE, VIBRATE, BILLING
- [x] Target SDK 36
- [x] Signed release APK + AAB built 12 Nov 2026 with a new upload key (kept outside the repo). Built with Google's **test** ad ids and the placeholder privacy URL, so they are for device and closed testing only; rebuild with real ids (raise `versionCode`) before production

## C. Legal and compliance (not verified — needs you)

- [ ] **Privacy policy** — draft `store/privacy-policy.html` (and in-app `web/privacy.html`) has `[DATE]`, `[DEVELOPER NAME]`, `[CONTACT EMAIL]`; review and host it, set `privacyUrl`
- [x] Ad privacy choices — Settings shows the UMP privacy-options button when required
- [ ] Data safety — advertising ID + device info (AdMob); purchase history (Play); optional Android backup of the save
- [ ] Ads declaration: "Contains ads: Yes"
- [ ] Content rating (IARC) — no violence; fantasy brewing theme. Suggested Everyone / PEGI 3
- [x] Third-party assets — none; orb art is procedural, audio synthesised, system fonts. esbuild is a build-time dev dependency only
- [ ] Name / trademark check for "Brewfall"

## D. Monetization readiness

- [~] Rewarded ads — revive (once per run), ×2 run Glints, free shop reroll, 5×40 Glints per day, ×2 daily gift. Flow tested with simulated ads; **never run against live AdMob**
- [x] Interstitials only between runs, never in the first 3 runs, ≥ 4 minutes apart, never for Remove Ads owners (tested)
- [x] Failed/cancelled videos grant nothing; double-pay guarded (tested)
- [~] Purchases — Moonstone packs, Founder's Pack, Remove Ads; duplicate tokens rejected; local signature verifier unit-tested (`PurchaseVerifierTest.kt`). **Never run against live Play Billing**
- [ ] Create the six products in Play Console (`moon_80`, `moon_450`, `moon_1000`, `moon_2400`, `starter_pack`, `remove_ads`); licence-tester purchase / cancel / pending / restore tests
- [x] Everything that affects play can be earned free (Moonstones buy cosmetics, revives and Glints only)

## E. Final device testing (needs real devices)

- [x] Headless Chromium (Pixel 7 profile, 320×568 smallest) — fits without overflow
- [x] Frame rate with a crowded cauldron at 4× CPU slowdown — ~44 fps
- [x] Run resume after quit / reload is exact (tested)
- [x] Reduced motion — screen shake and CSS animations off (added this audit)
- [ ] Physical phone: touch aiming feel, haptics, back button, audio, consent form
- [ ] Low-end device 30-minute session (memory, heat)
- [ ] Android backup/restore of the save across reinstall

## F. Publishing documentation

| Field | Value |
|---|---|
| Final title | Brewfall: Merge Roguelike |
| Tagline | Merge · brew · break the recipe. |
| Short description | Drop, merge and chain essences. Build wild charm combos. Beat every order. |
| Key features | Physics merge cauldron · 8-order roguelike runs with rival hexes · charm shop that rewrites scoring · familiars and stakes · Daily Brew with a shared seed · missions, achievements, daily gifts · cosmetics |
| Category | Puzzle (tags: Merge, Roguelike, Casual) |
| Suggested rating | Everyone / PEGI 3 (subject to IARC) |
| Required assets | icon ✔, feature graphic ✔, 8 screenshots ✔, privacy policy URL ✘ |

### Outstanding publishing requirements

| Severity | Item |
|---|---|
| Critical | Host privacy policy; set `privacyUrl` |
| Critical | Real AdMob ids and Play licence key |
| Critical | Signed release build installed and played on a physical phone (never done) |
| High | Play products created and licence-tested |
| High | Data safety / ads / content rating forms; closed-test requirement |
| High | Human balance and fun playtest (bot-tuned only) |
| Medium | Listen-through of synthesised audio |
| Low | Tablet screenshots; localisation |
