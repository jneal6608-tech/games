# QA report — 11 November 2026

## What was tested and how

| Area | Method | Result |
|---|---|---|
| Full player journey: welcome, first run, coach marks, boon draft, death, revive offer, summary, ×2 reward, Workshop, Flames, Quests, Shop, Settings, second run, reload | `tools/smoke.js`, Chromium at 390×844, touch | Pass, no page errors |
| Ads/billing contract between JavaScript and Android (mock bridge): failed ad gives nothing, completed ad revives, double reward once only, localised prices, gem and permanent purchases, Keeper skips ads, purchases delivered outside a request, back button | `tools/bridge_test.js`, 13 checks | Pass |
| Persistence: reload keeps progress; corrupt save falls back to backup; both slots corrupt gives a clean start; interrupted run's Embers are recovered | `tools/bridge_test.js` | Pass |
| Offline earnings: 3 h away at 5%/h of a 1,000-Ember best run shows +150 | `tools/bridge_test.js` | Pass |
| Performance: 220 enemies on screen at the enemy cap | `tools/bridge_test.js` | Median 16.7 ms, p95 16.8 ms per frame (60 fps) on software rendering |
| Progression and difficulty curve over 60 runs | `tools/balance.js` | Three tuning passes; see pacing table in the design doc |
| Small screen (360×640), large text, high contrast | Screenshots reviewed | Layout holds |
| Android build | `gradle assembleDebug assembleRelease lintDebug` | Builds; lint 0 errors, 9 warnings (fixed-portrait and dependency-version notices) |

## Not tested

- **No run on an Android device or emulator.** The container has no hardware virtualisation. The WebView host, immersive
  mode, lifecycle handling and vibration are compiled and linted only.
- **AdMob, the consent form and Play Billing against live services.** They need your accounts.
- Audio was not listened to; it is generated code that ran without errors.
- Long-term balance beyond difficulty 3 is extrapolated from the formulas, not simulated in depth.

## Known limitations

- Simulated ads and the test store in the browser build are for development only.
- Game text is English only.
- A run is not resumed if Android kills the app mid-run; the Embers earned so far are granted on next launch instead.
