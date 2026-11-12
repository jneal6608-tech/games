# Emberhold: Idle Defense

Project 04. An idle roguelite defense game for Android: you keep the last campfire alight against waves of shades.

- **Playable build:** `dist/emberhold-1.0.0-debug.apk` (install on any Android 8.0+ phone; uses Google's test ads).
- **Why this game:** `docs/01-market-research.md` (22 concepts scored, sources cited).
- **Design, economy, monetisation:** `docs/02-game-design.md`.
- **What is left before the Play Store:** `docs/03-release-checklist.md`.
- **Test evidence:** `docs/04-qa-report.md`.

## Layout

| Path | What it is |
|---|---|
| `web/` | The whole game: HTML5 canvas + DOM UI, plain JavaScript, no build step, no external assets |
| `web/js/data.js` | Every number in the game: upgrades, enemies, boons, flames, abilities, quests, store |
| `web/js/sim.js` | Run simulation, DOM-free so it also runs in Node |
| `web/js/render.js`, `audio.js` | Procedural art and fully synthesised sound and music (nothing to license) |
| `web/js/main.js`, `ui.js`, `save.js`, `platform.js` | Economy and loop, screens, persistence, ads/billing bridge |
| `android/` | Gradle project: WebView host, AdMob rewarded ads, UMP consent, Play Billing |
| `tools/` | `balance.js` (headless progression sim), `smoke.js` and `bridge_test.js` (browser tests) |
| `store/` | Listing text, icon, feature graphic, screenshots |

## Run it

Play in a desktop browser (ads are simulated; add `?devstore=1` to simulate purchases):

```bash
python3 -m http.server 8765 -d web
```

Build the Android app (needs JDK 17+, Android SDK platform 35; set `sdk.dir` in `android/local.properties`):

```bash
cd android && gradle assembleDebug
```

Tests (need Node and Playwright; start the web server above first):

```bash
node tools/balance.js 40
```

```bash
node tools/smoke.js /tmp/shots
```

```bash
node tools/bridge_test.js
```

## Engine choice

The game is HTML5 inside an Android WebView rather than Unity. Reasons: the whole game is 2D vector art that a canvas
draws at 60 fps with 220 enemies on screen; the APK is 7 MB; the same code ships to web portals; and it could be built and
automatically tested end to end in this environment, which a Unity project could not.
