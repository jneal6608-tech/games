# Testing report (12 Nov 2026)

## What was tested, and how

| Area | Method | Result |
|---|---|---|
| Rules: scoring, chains, charm order, 9 specific charms, recipes, hexes, tonics, shop, slots, revive | 18 automated tests (`tests/logic.test.mjs`) | 18/18 pass |
| Whole runs | Bot plays full runs with real physics; same seed gives identical runs | Pass; no errors, essences stay in bounds |
| Real touch play in a browser (Pixel 7 profile, Chromium) | 46 automated checks (`tests/e2e.mjs`), run 5 times in a row | 46/46, 5 of 5 runs |
| Tutorial | Tips appear in order and are recorded | Pass |
| Currency earning and spending | Daily gift, run payout, missions, achievements, video rewards, unlocks, exchange; overspending refused | Pass |
| In-run shop and meta shop | Buy, sell, reroll, cannot overspend, equip cosmetics | Pass |
| Save / load | Kill and reload mid-brew resumes drops, score, charms and cauldron exactly; corrupted save falls back to backup; unreadable save starts clean | Pass |
| Ad rules | Reward gating, one revive per run, one free reroll per shop, no interstitial in first 3 runs, 4-minute cap, none for Remove Ads owners | Pass **with simulated ads** |
| Purchase handling | Delivery, same token never delivered twice, failed purchase grants nothing, one-time items not repeatable | Pass **with a simulated store** |
| Purchase signature check (native) | 6 JVM unit tests: genuine, tampered, forged, wrong key, garbage, token ledger | 6/6 pass |
| Small screen | 320x568 layout check | Pass |
| Performance | 70 essences poured in at once (they merge down to ~20) at 4x CPU throttle in desktop Chromium | 51 fps average, worst single frame 150 ms. A desktop browser, not a phone |
| Android build | Debug + release APK and AAB build; R8 minified; `apksigner` verifies; Android lint | 0 errors, 12 minor warnings |

## Bugs found and fixed during testing
1. Merged essences could launch neighbours out of the cauldron (physics overlap). Fixed by growing merged essences in and capping push speed.
2. A new player's daily gift started on day 2. Fixed.
3. A brew could hang forever with 0 drops if an essence kept wobbling. Added a 4-second fallback.
4. After Android recreated the screen, the game page stayed blank. Fixed (always reloads; state comes from the save).
5. Purchase verification used an API missing on Android 7 (would crash). Minimum raised to Android 8.0.
6. Tutorial bubble covered the HUD; Daily Brew label wrapped badly. Fixed.

## NOT tested — please read
- **The app has not been run successfully on an Android device or emulator.** This machine has no hardware virtualisation; an Android 14 emulator did boot in software mode, the APK installed and the activity launched, but the emulator was too slow to be meaningful (Android's own System UI, Phone and Bluetooth processes were crashing and timing out, and its Chromium renderer crashed inside its own library). I cannot tell from that whether the game renders correctly on a phone. **First job: install `release/brewfall-1.0.0-debug.apk` on a real phone.**
- **Real ads** (AdMob) and the **consent form**: code compiles against the SDK; never executed with a real ad.
- **Real Google Play purchases**: need the app in a Play Console test track with licence testers. The native billing code has only been compiled and unit-tested at the verification layer.
- In-app review prompt, vibration, back button, Android backup/restore: written, not run on a device.
- Balance and fun: bot-tuned only; no human playtest.
- Older WebView versions, tablets, foldables, low-end phones.
- Sound was not listened to (synthesised; verified only that it throws no errors).
