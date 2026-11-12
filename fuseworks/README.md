# Fuseworks

A portrait puzzle roguelike for Android: build a firework display on a night-sky grid, light **one** fuse, watch the whole sky chain-react.

- Free, **no forced ads**. Opt-in rewarded ads plus a one-time Premium unlock.
- All art is drawn by code and all sound is synthesised: there are no image or audio assets.
- TypeScript + Vite + HTML canvas, packaged for Android with Capacitor 8 (target API 36).

| Document | What it is |
| --- | --- |
| `docs/MASTER_PROMPT.md` | The complete, self-contained development brief (full game design + technical spec) for an AI coding agent |
| `docs/BLUEPRINT.md` | Market research, the 15 scored concepts, why this one, commercial strategy, costs, remaining human work |
| `docs/PUBLISHING.md` | Step-by-step Google Play guide, pre-release checklist, store form answers, update process |
| `docs/privacy-policy.md` / `.html` | Privacy policy to fill in and host |
| `store/` | Listing text, icon, feature graphic, screenshots |
| `builds/` | Ready-made signed release APK (install on a phone) and AAB (upload to Play) for version 1.0.0 |

## Run it

Requirements: Node 22+.

```bash
npm install
```

```bash
npm run dev
```

Open the printed address in a browser and use the device toolbar (phone size, touch on). In the browser, ads and the purchase are replaced by clearly labelled test dialogs.

## Check it

```bash
npm test
```
Engine unit tests (scoring, charms, show flow, market, determinism, saves, progression).

```bash
npm run build
```
Type-check and production build into `dist/`.

```bash
npm run e2e
```
Plays the built game in headless Chromium at phone size with real pointer input, through every screen. Needs Playwright with Chromium available. Screenshots land in `e2e/shots/`.

```bash
npm run sim
```
Balance report: bots of four skill levels play 60 seeded festivals each (add a number for more, e.g. `npm run sim -- 200`).

## Build for Android

Requirements: JDK 21, Android SDK (`platforms;android-36`, `build-tools;36.0.0`), and `android/local.properties` with `sdk.dir=/path/to/sdk`.

```bash
npm run android:debug
```
→ `android/app/build/outputs/apk/debug/app-debug.apk`

```bash
npm run android:release
```
→ signed `app-release.apk` and `app-release.aab` under `android/app/build/outputs/`, if `android/keystore.properties` exists (see `docs/PUBLISHING.md`). The keystore is deliberately not in git.

Install on a phone: copy the APK to the phone and open it (allow "install unknown apps" for your file manager), or with USB debugging:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### Ten-minute test script for a real phone
1. Launch. Dark splash, then the title with fireworks. Music starts after the first touch.
2. New Festival → follow the coach: drag a shell to the star cell, add more, tap a shell, Light fuse.
3. Check nothing is hidden behind the status bar, camera cut-out or gesture bar.
4. Clear the show, buy something at the Market, start the next show.
5. Press the Home button mid-show, reopen: the run is exactly where you left it. Force-close and reopen: same.
6. Lose a show on purpose → Encore → a Google **test** ad plays → you get one more Match. Try closing an ad early: no reward.
7. Settings: toggle sound, music, vibration, reduced effects.
8. Play the Daily Show to the end and use Share result.
9. Watch for stutter during a large chain on your oldest phone.

## How the code is organised

```
src/engine/     pure rules: no DOM, no timers, no Math.random. Fully unit-tested.
  data.ts       every shell, charm, weather, crate, sky, stake and tuning number
  run.ts        show flow, chain resolution, scoring, market
  meta.ts       permanent save, unlocks, achievements, daily streak, save migration
  rng.ts        seeded RNG
src/render/     canvas: sky, board, shell tokens, particles
src/audio/      synthesised sound effects and generative music
src/platform/   storage, haptics, rewarded ads, purchases, share (with browser fallbacks)
src/ui/         screens, input, animation sequencing, autosave
src/config.ts   IDs and URLs to change before release
sim/            balance bot       tests/  unit tests       e2e/  end-to-end test
tools/          asset, screenshot and doc generators
android/        Capacitor Android project
```

The UI never computes a score: it calls the engine and animates the result it gets back. A whole run is one JSON object, so saving and resuming are trivial and deterministic.

## Maintenance guide

**Add a shell.** Add its id to the `ShellType` union and an entry in `SHELLS` (`src/engine/data.ts`) with a burst pattern. Optionally give it its own particle style in `Stage.burst` (`src/render/stage.ts`). Special behaviour goes in `resolve()` in `run.ts`.

**Add a charm.** Add an entry to `CHARMS`, then implement its effect in `resolve()` (scoring) or `startShow()` (show setup). Add a test.

**Add weather, a crate, a sky, a stake or an achievement.** Add an entry to the matching table in `data.ts` (or `ACHIEVEMENTS` in `meta.ts`). Weather effects are applied in `startShow()`, `reach()` or `resolve()`.

**Rebalance.** Change numbers in `data.ts` only, run `npm run sim`, and compare with the goals in the master prompt (section 3.8). Then run `npm test`: a few tests assert exact prices and rewards and will tell you what you changed.

**After any content or balance change** regenerate the master prompt so it stays truthful:

```bash
npx tsx tools/gen-docs.ts
```

**Regenerate icons, store graphics or screenshots.**

```bash
node tools/gen-assets.mjs
```

```bash
node tools/screenshots.mjs
```

**Saves and updates.** Player data lives under the keys `fuseworks.meta.v1` and `fuseworks.run.v1`. `migrateMeta()` fills in new fields and drops unknown ids, so adding content never breaks an old save. Removing or renaming an id that a run in progress uses can: prefer adding to removing, and if the `RunState` shape must change incompatibly, bump its `v` so old runs are discarded cleanly rather than loaded wrongly.

**Ship an update.** See `docs/PUBLISHING.md` section 9.

## Continuing development in a new AI session

Give the agent this repository and say: "Read `README.md` and `docs/MASTER_PROMPT.md`, run `npm install && npm test && npm run build && npm run e2e`, then …". Everything it needs is in those two files. The Android SDK is only needed for packaging.

## Known limitations

See the checklist in `docs/PUBLISHING.md` section 0 for the IDs still set to test values. Beyond that:

- **Not yet run on a physical Android device or emulator.** The Android packages were built and their signature, manifest and SDK levels inspected, and the game itself was tested in Chromium (the same engine family as Android's WebView) at phone size. Touch feel, audio latency, safe-area insets, haptics and frame rate on real hardware are unverified.
- **Real ads and real purchases are unverified.** The AdMob and Play Billing code paths can only run in a build installed from a Play test track. They are wired to Google's test IDs; the reward logic around them is tested with stand-in dialogs.
- English only. No cloud save and no online leaderboard (the Daily Show is identical for everyone but scores are compared by sharing).
- The name "Fuseworks" has had a quick web search, not a trademark clearance.
