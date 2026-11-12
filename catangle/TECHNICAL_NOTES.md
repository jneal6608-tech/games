# Technical notes

## Architecture

| Part | Where | Notes |
|---|---|---|
| Game | `web/` | Plain HTML, CSS and JavaScript modules. No build step, no framework, no image or audio files. |
| Android shell | `android/` | One Java activity hosting the game in a WebView, plus ads and billing classes. |
| Tests | `tests/` | Logic test (Node) and a full play test (Playwright). |
| Tools | `tools/` | Icon and store-graphic renderer, marketing clip recorder. |

Why a web game in a native shell: the game is 2D and turn-based, so a canvas runs it comfortably; it could be tested end to end in this environment; the release APK is 2.6 MB; and the same code can go to the web or iOS later.

## Game modules (`web/js`)

| File | Role |
|---|---|
| `levelgen.js` | Deterministic generator. Fills the grid with random paths, repairs cycles until a greedy solve clears the board, then assigns grumpy and sleepy cats against a planned solution. |
| `game.js` | Rules for one level: tap, bump, hearts, sleep, countdown, treat, revive, hint. |
| `render.js` | Canvas drawing for cats, board and background. |
| `main.js` | Screens, input, animation, rewards, shop, collection, settings, clip mode. |
| `data.js` | Coats, rooms, prices and economy numbers. Tune the game here. |
| `save.js` | Save file in localStorage with a backup copy. |
| `audio.js` | Sound effects synthesised with Web Audio. |
| `platform.js` | The only link to ads, purchases and haptics. Uses a mock in a browser. |

## Android shell

- `MainActivity`: loads `https://appassets.androidplatform.net/assets/index.html` from the APK, blocks navigation elsewhere, handles insets, back button and state.
- `AdsManager`: Google Mobile Ads 24.9.0 with the consent (UMP) flow. Preloads one rewarded and one interstitial ad.
- `BillingManager`: Play Billing 8.3.0. `remove_ads` is acknowledged; fish packs are consumed. Grants reach the game as events and are de-duplicated by purchase token.
- Min Android 7.0 (API 24), target API 36. Portrait only.
- Ad ids default to Google's public test ids. Real ids go in `android/ads.properties` (git-ignored).
- Save data lives in the WebView's storage and is included in Android backup.

## Build and test

Run from `games/catangle`:

```bash
node tests/logic.test.mjs
```

```bash
python3 -m http.server 8765 --directory web
```

```bash
NODE_PATH=$(npm root -g) node tests/e2e.mjs
```

Run from `games/catangle/android` (needs the Android SDK; set `sdk.dir` in `local.properties`):

```bash
./gradlew assembleDebug
```

```bash
./gradlew bundleRelease
```

## What was tested, and what was not

| Check | Result |
|---|---|
| 600 levels and 120 daily puzzles valid and winnable with no mistakes | Passed |
| Hint engine alone wins every level | Passed |
| Full play test at phone size: first session, hearts, continue, hints, treats, save reload, daily, shop, collection, chapter chest, special cats, ad pacing, settings, reset | Passed |
| Layout at 320x568, 390x844, 412x915, 800x1280 | Passed |
| Level generation time | 4 ms worst case |
| Debug APK, minified release APK, release bundle build | Passed |
| Android lint | 16 minor warnings (icon shape, newer library versions available), no errors |
| Running on an Android device or emulator | **Not done.** This environment has no emulator. |
| Real ads and real purchases | **Not done.** Tested only through the browser mock; the native code compiles but has never executed. |
| Frame rate on a low-end phone | **Not measured.** |

## Known limits

- Library versions are one major behind the newest (Ads 25, Billing 9, AGP 9) because those are the ones verified to compile here. Play may require newer ones over time.
- A consumable purchase is consumed before the game records it. If the app is killed in that instant the grant is lost.
- No analytics or crash reporting yet (needs your approval; see `NEXT_STEPS.md`).
- Marketing clips are recorded from the browser at 540x960 and upscaled, with no sound. Recording on a phone gives sharper video with audio.
- `PRIVACY_URL` in `data.js` is a placeholder.
