# Progress log

**Status (12 Nov 2026): feature-complete build produced; not yet run on a real Android device; not uploaded to Google Play.**

| Stage | State |
|---|---|
| Market research, 22 concepts scored, winner chosen | Done (`MARKET_RESEARCH.md`, `COMPETITOR_ANALYSIS.md`) |
| Core game: physics, scoring, 31 charms, 7 tonics, 8 hexes, shop, 8 orders, endless | Done |
| Meta: Glints, Moonstones, Codex unlocks, familiars, stakes, cosmetics | Done |
| Retention: daily gift, daily missions, achievements, Daily Brew, records | Done |
| Menus, tutorial tips, settings, pause, auto-save and resume | Done |
| Sound effects and music (synthesised) | Done, not listened to |
| Android app: WebView shell, AdMob + consent, Play Billing with verification, backup | Written and compiling; not run on a device |
| Automated tests | 18 logic + 46 browser + 6 native unit tests passing; lint 0 errors |
| Signed AAB + APKs | Built (`release/`) with test ad IDs and the store closed |
| Store assets and texts, privacy policy draft, data safety, content rating | Done (`store/`) |
| Real-device test, real ads, real purchases, Play upload | **Not done** (needs your phone and accounts) |

## Decisions made on your behalf
- Concept: drop-merge roguelike score-builder; title "Brewfall".
- Engine: web tech in a native Android shell instead of Unity (testable here, tiny APK, no fees).
- Premium currency: yes (Moonstones), cosmetic/convenience only.
- Minimum Android 8.0; target Android 16.
- No servers, analytics or paid services.
- The project lives in `games/brewfall/` on branch `claude/determined-sagan-2vkqpe` of the animation-studio repository because that was the only repository attached to the session; it touches nothing in the studio. It should move to its own repository.
