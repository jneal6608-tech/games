# Handoff prompt for the next AI developer

You are taking over **Brewfall**, a free-to-play Android drop-merge roguelike in `games/brewfall/` (branch `claude/determined-sagan-2vkqpe` of `jneal6608-tech/animation-studio`; the rest of that repository is an unrelated animation studio — do not modify it, and ignore its CLAUDE.md video rules for game work).

Read first, in this order: `PROGRESS.md`, `TESTING_REPORT.md` (especially "NOT tested"), `NEXT_STEPS.md`, `TECHNICAL_NOTES.md`.

State: the game is feature-complete and passes its automated tests in desktop Chromium. The Android shell compiles, is signed and lint-clean, but **has never been confirmed running on a device**; ads use Google test IDs; the store is closed until a Play licence key is configured; nothing is uploaded to Play.

Setup: Node 22, `npm install`, `node tools/build-web.mjs`; Android SDK platform 36 + build-tools, JDK 17+, `android/local.properties` with `sdk.dir`, then `gradle :app:assembleDebug`. `android/keystore.properties` and the keystore are not in git: ask the founder for them or build debug only. Playwright with Chromium is needed for `tests/e2e.mjs` (serve `dist/` on port 8377).

Resume here:
1. Ask the founder what happened when they installed the debug APK on a phone; fix anything found (suspects: WebView compatibility, safe-area insets, audio unlock, back button).
2. Then follow `NEXT_STEPS.md` development follow-ups.

Rules of the project: all content and numbers go in `web/src/data.js`; keep `run.js` free of DOM code and add a test for every rule change; never grant a purchase without the token check in `save.js: grantPurchase`; no paid services, new SDKs or data collection without the founder's approval; never claim something was tested on a device unless it was; keep the ten documentation files current.
