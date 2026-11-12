# Emberhold — Release Checklist

Status legend: `[x]` verified in this repo · `[ ]` not done / needs you · `[~]` partly done or done but unverified.
Last audit: 12 Nov 2026. Platform: Android (WebView shell around `web/`), plus an itch.io web preview zip.
See also `docs/03-release-checklist.md` (original build notes) and `docs/04-qa-report.md`.

## A. App store assets

- [x] App icon 512×512 — `store/icon-512.png`; adaptive + monochrome launcher icon in `android/app/src/main/res/drawable/ic_*.xml`
- [x] Title — **Emberhold: Idle Defense** (23/30 chars)
- [x] Short description — `store/listing.md`
- [x] Full description — `store/listing.md`
- [x] Feature graphic 1024×500 — `store/feature-1024x500.png`
- [x] Phone screenshots 1080×1920 (5) — `store/screenshots/`
- [ ] Tablet screenshots — optional
- [x] Consistent branding — ember-orange on night palette across icon, splash, UI and feature graphic

## B. Technical release requirements

- [x] Production build config — release type uses `minifyEnabled true` + `shrinkResources true`; signing from `~/.gradle/gradle.properties`
- [ ] **Application id final** — `com.emberhold.game` (permanent after first upload)
- [~] **Target SDK raised 35 → 36 this audit** (Play's 2026 requirement for new apps/updates). App was already edge-to-edge. **Needs a Gradle build + device check** — no Android SDK in the audit container
- [x] No debug interfaces — the test store needs `?devstore=1`; the web "Bonus" placeholder is labelled honestly as a web-preview bonus
- [x] No secrets in the repo — keystore values come from `~/.gradle/gradle.properties`
- [ ] **Real AdMob ids** — `android/app/build.gradle` still uses Google's public test app id and rewarded unit
- [x] Asset paths — `WebViewAssetLoader` https origin; no network assets
- [x] Error handling — `G.fail` saves and shows a recoverable error card; corrupt save → backup → clean start (tested)
- [x] WebView renderer crash recovery — added this audit
- [x] Permissions — INTERNET, ACCESS_NETWORK_STATE, VIBRATE, BILLING
- [ ] **Rebuild `dist/` APK/AAB** — the checked-in `emberhold-1.0.0-debug.apk` and `-release.aab` predate this audit's fixes. The itch zip was rebuilt.

## C. Legal and compliance (not verified — needs you)

- [ ] **Privacy policy** — draft created this audit at `store/privacy-policy.md` (fill in `[DATE]`, `[YOUR NAME OR COMPANY]`, `[EMAIL]`, have it reviewed, host it)
- [ ] **`EH.PRIVACY_URL` in `web/js/ui.js` is a placeholder (`example.com`)** — Critical
- [x] Ad privacy choices entry point — "Ad privacy choices" button added to Settings this audit (shown only when the consent SDK requires it). **Untested on device**
- [ ] Data safety form — advertising ID (AdMob); purchase history (Play)
- [ ] Ads declaration: "Contains ads: Yes"
- [ ] Content rating — fantasy violence (abstract shades), in-app purchases. Suggested Everyone 10+ / PEGI 7 (subject to IARC)
- [x] Third-party assets — none; art is procedural canvas drawing, audio is synthesised (WebAudio), system fonts
- [ ] Name / trademark check for "Emberhold"

## D. Monetization readiness

- [~] Rewarded ads — revive, ×2 run Embers, ×2 offline Embers, free reroll, 4 free-gem videos/day. Logic tested with a mock bridge (`tools/bridge_test.js`); **never run against live AdMob**
- [x] No interstitials or banners at all — no forced ads (matches the store description)
- [x] Failed/cancelled ad grants nothing; a second tap while a video loads cannot pay twice (guard added this audit)
- [~] Purchases — `keeper_pack`, `starter_pack`, `gems_1`…`gems_4`; Keeper skips ads. Tested only with a mock bridge
- [ ] Create the six products in Play Console; licence-tester purchase / cancel / restore tests
- [ ] Purchases are verified on-device only (no server). Acceptable for launch; revisit if fraud appears

## E. Final device testing (needs real devices)

- [x] Headless Chromium at 360×640, 390×844, 412×915; large text + high contrast
- [x] Portrait only
- [x] 220 enemies on screen at ~60 fps (software rendering)
- [x] Interrupted run: Embers recovered exactly once even if the app is killed right after relaunch (bug fixed + `tools/recovery_test.js`)
- [ ] Physical phone: notch / gesture bar, back button, audio after backgrounding, 30-minute battery and heat check
- [ ] Offline earnings across a real overnight close
- [ ] Low-end device frame rate during late waves at 3× speed

## F. Publishing documentation

| Field | Value |
|---|---|
| Final title | Emberhold: Idle Defense |
| Tagline | Keep the last fire burning. |
| Short description | Keep the last fire burning. Idle roguelite defense with no forced ads. |
| Key features | Auto-fighting Ember with mid-run upgrades · boon draft every 5 waves · permanent Workshop · 5 flames, 3 abilities, 6 difficulties · offline earnings · daily gifts, quests, achievements · no forced ads |
| Category | Strategy (alt: Casual) — tags: Idle, Tower defense, Roguelite |
| Suggested rating | Everyone 10+ / PEGI 7 (subject to IARC) |
| Required assets | icon ✔, feature graphic ✔, 5 screenshots ✔, privacy policy URL ✘ |

### Outstanding publishing requirements

| Severity | Item |
|---|---|
| Critical | Host privacy policy; replace `EH.PRIVACY_URL` |
| Critical | Real AdMob ids |
| Critical | Fresh signed AAB built from current source and installed on a physical device (verifies the SDK 36 bump and new Java code) |
| High | Play products created and licence-tested |
| High | Data safety, ads, content-rating forms |
| High | Closed testing track requirement (personal accounts) |
| Medium | Crash reporting / analytics (needs your approval + privacy-policy update) |
| Low | Localisation; tablet screenshots |
