# Master Release Report — five games

Audit date: 12 November 2026. Each game has its own `RELEASE_CHECKLIST.md`; this file summarises them.

## How the audit was done, and its limits

- Every game's existing automated suites were run before and after the changes (logic tests, browser end-to-end
  tests in headless Chromium at phone sizes with touch emulation, balance simulators). Screenshots were reviewed for
  visual defects. Bugs were reproduced before fixing where possible (the Emberhold relaunch bug failed on the
  original code and passes on the fix).
- **No game has been run on a physical Android device or emulator.** No Android SDK was available, so the small Java
  changes (Catangle, Emberhold) are compiled-unverified.
- **Lurelight (Godot) could not be run**: downloading and executing the Godot engine was not permitted in the audit
  environment. Its code was reviewed by reading, and edited scripts were syntax-checked with `gdtoolkit`.
- Live AdMob, the consent form and Google Play Billing have never been exercised for any game. All five use Google's
  test ad ids and placeholder privacy-policy URLs.

## Readiness scores

Scores rate the current build on the evidence available. None of the five is publish-ready: every one has Critical
items that need your accounts or a real device (privacy policy hosting, real ad ids, a device test).

| Game | Function /25 | Stability /20 | Mobile /15 | UI/UX /15 | Gameplay /15 | Perf /10 | **Total** | Publish-ready? |
|---|---|---|---|---|---|---|---|---|
| Catangle | 23 | 18 | 12 | 14 | 12 | 9 | **88** | No — external blockers only |
| Emberhold | 23 | 18 | 12 | 13 | 13 | 9 | **88** | No — external blockers only |
| Fuseworks | 23 | 18 | 12 | 14 | 13 | 7 | **87** | No — external blockers only |
| Brewfall | 23 | 18 | 12 | 13 | 11 | 8 | **85** | No — external blockers + human balance pass |
| Lurelight | 19 | 13 | 9 | 12 | 13 | 6 | **72** | No — engine test run + device test needed first |

Mobile scores are capped at 12 because nothing has touched a real phone. Lurelight's lower scores reflect what could
not be verified, not known defects.

## Per-game reports

### 1. Catangle — cat escape puzzle (vanilla JS in a Java WebView shell)

1. **Before:** feature-complete, polished, thorough tests. Good condition.
2. **Bugs found:** (a) *Clip mode* in Settings auto-solved the player's current level and still paid fish and advanced the level — an unlimited free-progress exploit; (b) a clip that lost restarted as a manual level with the HUD hidden; (c) a Daily Tangle finished after midnight was credited to the wrong day; (d) a hint was spent even when no cat could move; (e) a corrupt main save could overwrite the good backup; (f) the browser build granted rewards from simulated ads on any host; (g) Tuxedo / Sky / Golden / Calico coats drew as hard white rectangles; (h) no recovery if Android kills the WebView renderer.
3. **Fixed:** all of the above.
4. **Gameplay:** no hint waste; clip mode can no longer short-circuit progression.
5. **Visual:** patch coats redrawn as rounded spots inside the body; reduced-motion disables shake and thins confetti.
6. **Performance:** generator verified to level 20,000 (≤ 15 ms per level, all solvable).
7. **New:** 1080×1920 store screenshots + generator script, regression test for the clip exploit.
8. **Remaining:** board size plateaus at 9×12 after ~level 1000 (fine for launch); no analytics.
9. **Testing:** 600 levels + 120 dailies validated; full e2e (win, lose, continue, hint, treat, daily, shop, collection, chapter chest, interstitial pacing, settings, reset, 4 screen sizes) passes.
10. **External:** privacy policy + `PRIVACY_URL`, AdMob ids, Play products, device test.

### 2. Emberhold — idle roguelite defense (Game 4, vanilla JS in a Java WebView shell)

1. **Before:** feature-complete and well tested; rich retention (workshop, flames, quests, achievements, offline earnings).
2. **Bugs found:** (a) Embers recovered from an interrupted run were granted at launch but only saved 700 ms later, so a kill in that window paid them twice (reproduced); (b) backup-slot corruption (as Catangle); (c) ×2 Embers could fire twice if tapped again while the video loaded; (d) no way to reopen ad-consent choices (UMP requirement); (e) web preview called its free bonus a "Sponsored break"; (f) target SDK 35 (Play expects 36 in 2026); (g) no privacy-policy draft at all; (h) no renderer-crash recovery.
3. **Fixed:** all of the above.
4–6. **Gameplay/visual/performance:** already strong (220 enemies at ~60 fps); no changes needed beyond fixes.
7. **New:** "Ad privacy choices" in Settings (+ Android bridge), privacy-policy draft, `tools/recovery_test.js`, rebuilt itch zip.
8. **Remaining:** checked-in debug APK / release AAB in `dist/` predate the fixes — rebuild.
9. **Testing:** smoke playthrough, 20 bridge checks (ads, purchases, save recovery, offline, stress), recovery test, 60-run balance sim.
10. **External:** privacy policy + `EH.PRIVACY_URL`, AdMob ids, products, Gradle build verifying SDK 36, device test.

### 3. Fuseworks — firework chain-reaction roguelike (TypeScript + Vite + Capacitor)

1. **Before:** the most thoroughly tested of the five (54 unit, 80 e2e, 310 touch checks).
2. **Bugs found:** (a) any hosted browser build let players "simulate" Premium and ticket-pack purchases for free; (b) the progression save had no backup, so one unreadable write wiped all tickets and unlocks.
3. **Fixed:** both (simulated store only on localhost / `?dev=1`; mirrored backup save with fallback).
4–6. Balance sim healthy (stake 1 win rate 27–43% by skill tier); no changes.
7. **New:** `e2e/integrity.mjs`.
8. **Remaining:** 20-burst chains on the largest screen measured 28 fps under 4× CPU throttling in headless software rendering (target 30) — check on a real low-end phone. R8 is off.
9. **Testing:** type-check, 54 unit tests, 80 e2e checks, integrity checks; touch suite from the baseline run.
10. **External:** privacy URL + support email in `src/config.ts`, AdMob ids, products, device test.

### 4. Brewfall — merge roguelite (Game 5, vanilla JS bundled by esbuild into a Kotlin WebView shell)

1. **Before:** solid architecture (checksummed save, native backup copy, purchase verifier, honest dev-only mocks), 46 e2e checks.
2. **Bugs found:** backup-slot corruption; no reduced-motion support.
3. **Fixed:** both.
4–6. No gameplay changes: balance is bot-tuned only and needs human playtesting rather than more automated tuning.
7. **New:** release checklist.
8. **Remaining:** human balance/feel pass; audio never listened to.
9. **Testing:** 18 logic tests, 46/46 e2e (purchases, ads pacing, revive, resume, corruption recovery, 320×568 fit, 4× CPU throttle at ~44 fps).
10. **External:** privacy URL + AdMob/licence keys in `keystore.properties`, products, device test.

### 5. Lurelight — anglerfish arcade roguelite (Godot 4.7)

1. **Before:** feature-complete, with its own scripted UI test (`--uitest`). Never run on a phone.
2. **Bugs found (by code review):** quitting or restarting from the pause menu threw away every pearl from that dive without warning; a dive cut off by the system kept its depth but lost its pearls.
3. **Fixed:** unfinished dives now bank pearls and depth (no finish/daily bonuses, so no farming).
4–6. No other changes: without the engine, further tuning or visual work could not be verified.
7. **New:** uitest check for the cut-off case; release checklist.
8. **Remaining:** everything that needs the engine — run `--uitest`, frame rate, visuals at real sizes.
9. **Testing:** syntax check of all scripts only. **The changes have not been executed.**
10. **External:** engine test run, privacy URL, AdMob ids and `TEST_MODE`, products, device test.

## Outstanding issues by severity (all games)

| Severity | Issue | Games |
|---|---|---|
| Critical | Privacy policy not hosted; in-game URL is a placeholder or empty | all five |
| Critical | Google test ad ids in place; real AdMob app + unit ids needed | all five |
| Critical | Never installed and played on a physical Android phone | all five |
| Critical | Engine-level test run of the audited code (`--uitest`) | Lurelight |
| High | Play Console products not created; purchases never tested with licence testers | all five |
| High | Data safety, ads and content-rating forms; closed-test requirement for personal Play accounts | all five |
| High | Gradle build after this audit's Java changes / SDK 36 bump | Catangle, Emberhold |
| High | Human balance and feel playtest | Brewfall (bot-tuned only), Lurelight |
| Medium | Name/trademark clearance | all five |
| Medium | Crash reporting / analytics (needs your approval and privacy-policy update) | all five |
| Medium | Chain frame rate on large low-end screens | Fuseworks |
| Low | Tablet screenshots, localisation, R8 for Fuseworks | various |

## Recommended release order

1. **Catangle** — simplest systems, broadest audience, everything verifiable in the browser passes, lowest risk on first device test.
2. **Emberhold** — strongest retention loop and no forced ads; only external blockers plus a Gradle build check.
3. **Fuseworks** — most-tested codebase and the most distinctive concept; verify chain frame rate on a low-end phone first.
4. **Brewfall** — technically sound, but merge physics and balance need a human feel pass before launch.
5. **Lurelight** — likely good, but it is the least verified: run the Godot test suite and a device session before committing to a date.

Shipping one at a time lets the first launch's lessons (consent form, billing, Play review) feed the rest, since all
five share the same publishing path.
