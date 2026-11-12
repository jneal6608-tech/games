# Technical notes

## Engine choice
The game is written in plain JavaScript (Canvas 2D + DOM) and shipped inside a thin native Android app (Kotlin, WebView). Unity was considered and rejected for this project: it cannot be installed or licensed in this build environment, and this game is 2D with simple physics. The practical benefits: the whole game can be played and tested automatically in a desktop browser, the release APK is 2.2 MB, and there are no engine fees.

## Layout
```
games/brewfall/
  web/               game source
    src/data.js      ALL content and numbers (charms, tonics, hexes, prices, rewards, IAP)
    src/run.js       run rules: scoring, charms, shop (no DOM; unit-tested)
    src/physics.js   circle physics for the cauldron
    src/board.js     canvas drawing, touch input, game loop
    src/save.js      profile, currencies, missions, achievements, purchases granted
    src/platform.js  bridge to Android (ads, billing, haptics) with browser fallbacks
    src/audio.js     synthesised sound effects and music
    src/main.js      screens and flow
  android/           Gradle project (app id com.brewfall.game, min Android 8.0, target Android 16 / API 36)
  tests/             logic.test.mjs (18 tests), e2e.mjs (46 checks), bot.mjs (balance bot)
  tools/             build-web.mjs (bundle), store-assets.mjs (icon, feature graphic, screenshots)
  store/             listing text, graphics, privacy policy, data safety, content rating
  release/           brewfall-1.0.0.aab, -release.apk, -debug.apk
```

## Build
```bash
cd games/brewfall && npm install && node tools/build-web.mjs      # bundles the game into the Android assets
cd android && gradle :app:bundleRelease :app:assembleRelease      # needs Android SDK (platform 36) + JDK 17+
```
Tests: `node --test tests/logic.test.mjs`; serve `dist/` on port 8377 then `node tests/e2e.mjs`; `gradle :app:testDebugUnitTest :app:lintRelease`.
Browser dev mode: open `dist/index.html?dev=1` (simulated reward videos and purchases).

## Configuration and secrets
`android/keystore.properties` (git-ignored) holds the signing key details and live IDs: `storeFile`, `storePassword`, `keyAlias`, `keyPassword`, `applicationId`, `admobAppId`, `admobRewardedId`, `admobInterstitialId`, `playLicenseKey`, `privacyUrl`. Without it the build uses Google's test ad IDs and closes the store.

## Save system
One JSON profile in WebView localStorage, wrapped with a checksum; a rolling backup copy; and a third copy in the app's files directory (included in Android backup). On load: main → backup → device copy → new profile. A run in progress is saved after every drop and every shop action, so the app can be killed at any time.

## Native bridge
JS calls `window.BrewNative.*` (see `Bridge.kt`); native calls back through `window.__brewNative(event, json)`. Ads and billing start only after the game has loaded. The consent form (Google UMP) runs before any ad request. If the WebView renderer dies, the activity recreates itself and the game resumes from the save.

## Performance
Pre-rendered essence sprites, fixed 60 Hz physics with 4 substeps, device pixel ratio capped at 2, particle cap. Measured in Chromium with 4x CPU throttling and ~70 essences: see `TESTING_REPORT.md`.

## Adding content later
New charm/tonic/hex/skin/mission/achievement = one entry in `data.js` (charms can carry their own `merge`, `roundEnd`, `drops`, `repeat` hooks). Save files tolerate new fields (`merge()` in `save.js`); bump `v` and add a migration only for breaking changes.

## Known limitations
- Library versions are deliberately one major behind the newest (Billing 8.0, Ads 24.5) because those are the APIs I could build against with confidence; lint lists the newer ones.
- Portrait is fixed in the manifest; Android 16 ignores that on large screens, where the game is letterboxed to a 560 px column.
- Leaderboards are local only (no Play Games Services yet).
