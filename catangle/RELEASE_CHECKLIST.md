# Catangle — Release Checklist

Status legend: `[x]` verified in this repo · `[ ]` not done / needs you · `[~]` partly done or done but unverified.
Last audit: 12 Nov 2026. Platform: Android (WebView shell around the web game in `web/`).

## A. App store assets

- [x] App icon 512×512 — `docs/store/icon-512.png`; adaptive launcher icons in `android/app/src/main/res/mipmap-*`
- [x] Title — **Catangle: Cat Escape Puzzle** (27/30 chars)
- [x] Short description — in `docs/store/listing.md` (≤ 80 chars)
- [x] Full store description — in `docs/store/listing.md`
- [x] Feature graphic 1024×500 — `docs/store/feature-graphic-1024x500.png`
- [x] Phone screenshots 1080×1920 (5) — `docs/store/screenshots/` (regenerate with `tools/store_shots.mjs`)
- [ ] Tablet screenshots (7" and 10") — optional; the layout is verified at 800×1280 in `tests/e2e.mjs`
- [x] Consistent branding — Fredoka font, warm palette, same logo on icon / feature graphic / home screen
- [~] Promo video — three short-form clips in `marketing/clips/` (not a Play promo video; YouTube URL optional)

## B. Technical release requirements

- [x] Production build config — `android/app/build.gradle` release type has `minifyEnabled true`, signing from `keystore.properties`
- [ ] **Application id is final** — currently `com.catangle.game`. Permanent after first upload. Decide before uploading.
- [x] No debug UI in production — dev/test hooks are inert without `?dev`/`?fastads`; simulated ads are now only active in dev / localhost (fixed this audit)
- [x] No secrets in the repo — AdMob ids and keystore come from git-ignored `ads.properties` / `keystore.properties`
- [ ] **Real AdMob ids** — build falls back to Google's public *test* ids until `android/ads.properties` exists
- [x] Asset paths — served through `WebViewAssetLoader` (https origin), font bundled locally (`web/fonts/`)
- [x] Loading / error handling — corrupt save falls back to backup; storage failures keep the game playing in memory
- [x] WebView renderer crash recovery — `onRenderProcessGone` added this audit (restarts the screen instead of crashing)
- [x] Permissions — INTERNET, ACCESS_NETWORK_STATE, VIBRATE, BILLING only
- [x] Target SDK 36, min SDK 24 — verified in the built APK (`aapt2 dump badging`)
- [x] Signed release APK + AAB built 12 Nov 2026 with a new upload key (kept outside the repo; see the delivery notes). Built with Google's **test** ad ids and the placeholder privacy URL, so they are for device testing and closed testing only
- [ ] Install on a physical phone (no emulator possible in the build container)
- [ ] Rebuild with real AdMob ids + privacy URL (raise `versionCode`) before production

## C. Legal and compliance (not verified — needs you)

- [ ] **Privacy policy hosted** — draft at `docs/store/privacy-policy.md` still has `[DATE]`, `[YOUR NAME OR COMPANY]`, `[EMAIL]`
- [ ] **`PRIVACY_URL` in `web/js/data.js` is a placeholder (`example.com`)** — Critical: the in-game Privacy button opens it
- [ ] Data safety form — AdMob collects the advertising ID and device info; Play Billing handles purchase history
- [ ] Ads declaration — "Contains ads: Yes"
- [ ] Content rating questionnaire (IARC) — expected Everyone / PEGI 3, subject to the questionnaire
- [ ] Target audience — if you select ages under 13, AdMob must be configured for child-directed treatment and Families policy applies
- [x] Third-party licences — Fredoka font under SIL OFL (`web/fonts/OFL.txt`); all art is drawn in code; sounds are synthesised
- [ ] Trademark / name search for "Catangle" (a web search is not a legal clearance)
- [ ] UMP consent form tested with an EEA test device

## D. Monetization readiness

- [~] Rewarded ads — Double win reward, continue after a loss, free hint, 5 free-fish videos per day. Logic tested with simulated ads; **never run against live AdMob**
- [x] Failed / cancelled video grants nothing (tested in `tests/e2e.mjs`)
- [x] Interstitials — only from level 12, at most every 3 wins and 150 s apart, never for Remove Ads owners
- [x] Ads never shown mid-level; continue and hint videos are always player-initiated
- [~] Purchases — `remove_ads`, `fish_small`, `fish_medium`, `fish_large`; duplicate tokens ignored. **Never run against live Play Billing**
- [ ] Create the four products in Play Console with exactly those ids
- [ ] Licence-tester purchases: success, cancel, pending, refund, restore after reinstall

## E. Final device testing (needs real devices)

- [x] Screen sizes in headless Chromium: 320×568, 360×640, 390×844, 412×915, 800×1280
- [x] Portrait only (locked in manifest) — no landscape layout needed
- [x] Touch input (Playwright touch emulation)
- [ ] Physical Android phone: launch time, touch feel, back button, sound, haptics
- [ ] Low-end device (2–3 GB RAM): 30-minute session, check memory and frame rate
- [ ] Kill app mid-level → reopen: progress and fish kept (save is written on every change and on `pagehide`)
- [ ] Airplane mode: game plays fully offline; ad buttons say "No video available"

## F. Publishing documentation

| Field | Value |
|---|---|
| Final title | Catangle: Cat Escape Puzzle |
| Tagline | Untangle the cats. Send them home. |
| Short description | Untangle the cats! Tap the right cat, clear the board, collect them all. |
| Key features | Tap-to-escape logic puzzles · sleepy and grumpy cat mechanics · Daily Tangle with streaks · 16 coats & 4 rooms · endless generated levels · offline, no timers or lives |
| Category | Puzzle (tags: Logic, Casual, Offline) |
| Suggested rating | Everyone / PEGI 3 (subject to IARC questionnaire) |
| Required assets | icon ✔, feature graphic ✔, ≥ 2 phone screenshots ✔, privacy policy URL ✘ |

### Outstanding publishing requirements

| Severity | Item |
|---|---|
| Critical | Host the privacy policy and replace `PRIVACY_URL` in `web/js/data.js` |
| Critical | Real AdMob app / ad unit ids in `android/ads.properties` |
| Critical | Signed release build + install on at least one physical Android device |
| High | Play Console products created and tested with licence testers |
| High | Data safety, ads and content-rating forms completed |
| High | Closed test (12 testers × 14 days) if the Play account is a personal account created after Nov 2023 |
| Medium | Analytics / crash reporting (not included; needs your decision and a privacy-policy update) |
| Low | Tablet screenshots |
