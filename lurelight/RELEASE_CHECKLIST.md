# Lurelight — Release Checklist

Status legend: `[x]` verified in this repo · `[ ]` not done / needs you · `[~]` partly done or done but unverified.
Last audit: 12 Nov 2026. Platform: Android, Godot 4.7 (GL Compatibility), AdMob + Play Billing Godot plugins.
The step-by-step guide is `store/PUBLISHING.md`; this file is the release gate.

> **Audit limitation.** This audit could not run Godot (downloading and executing the engine was not permitted in
> the audit environment). Lurelight was reviewed by reading the code, and every edited script was syntax-checked
> with `gdtoolkit` (`gdparse`). **Run `godot --path . -- --uitest --fakeads --fakestore` before release** — it now
> includes a check for this audit's change.

## A. App store assets

- [x] App icon 512×512 — `store/icon_512.png`; `icon.svg` for the launcher
- [x] Title — **Lurelight** (listing text in `store/listing.md`)
- [x] Short + full description — `store/listing.md`
- [x] Feature graphic — `store/feature_graphic.png`
- [x] Phone screenshots — `store/screenshots/`
- [ ] Tablet screenshots — optional
- [x] Consistent branding — deep-sea palette, glowing lure motif on icon, feature graphic and menus

## B. Technical release requirements

- [x] Production export presets — `export_presets.cfg` (Gradle build, both plugins), version code 6 / name 0.2.1
- [ ] **Package id final** — `com.lurelight.game` (permanent after first upload)
- [ ] **Ad units** — `src/autoload/ads.gd`: `AD_UNITS` empty and `TEST_MODE := true` (Google test units)
- [ ] **AdMob App ID** in the AdMob plugin export settings (see `store/PUBLISHING.md` step 4)
- [x] Dev flags (`--autoplay`, `--fakeads`, `--fakestore`, `--uitest`, …) only read command-line *user* args; a store install never receives them
- [x] No secrets committed — release keystore and its password file are outside git
- [x] Save — atomic write (temp file + rename); unreadable save falls back to defaults without crashing
- [x] **Unfinished dives keep their pearls** (this audit): quitting from the pause menu, restarting from the pause menu, or the app being killed mid-dive now bank the dive's pearls and depth (no finish bonuses, so quitting a Daily Dive can't farm the streak bonus). Before, every pearl from that dive was silently lost
- [x] Permissions — VIBRATE (+ INTERNET/BILLING merged by the plugins)
- [ ] Rebuild signed `.aab`/`.apk` after this audit and re-run `--uitest`
- [ ] Target SDK — set by the Godot 4.7 Android template; confirm it meets Play's current requirement (API 36 for 2026) in the generated `android/build` before upload

## C. Legal and compliance (not verified — needs you)

- [ ] **Privacy policy** — `store/privacy-policy.html` / `.md` have `[PLACEHOLDERS]`; host it
- [ ] **`PRIVACY_URL` in `src/ui/screens.gd` is empty** — the Settings button stays hidden until it is set. Play requires the URL in the listing regardless
- [x] Ad privacy choices — Settings shows "AD PRIVACY CHOICES" when the consent SDK requires it
- [ ] Data safety — advertising ID (AdMob), purchase history (Play)
- [ ] Ads declaration: "Contains ads: Yes" (rewarded + paced interstitials)
- [ ] Content rating (IARC) — cartoon creatures eaten by an anglerfish; mild fantasy violence. Suggested Everyone 10+ / PEGI 7
- [x] Third-party licences — Nunito and Unbounded fonts (SIL OFL, licences in `assets/fonts/`), AdMob plugin (MIT, `addons/admob/LICENSE`), Godot Play Billing plugin (MIT); art and audio are original/generated
- [ ] Name / trademark check for "Lurelight"

## D. Monetization readiness

- [~] Rewarded ads — revive (once per dive, only after 40 s), double pearls, mutation reroll, double daily reward. Flows covered by `--uitest --fakeads`; **never run against live AdMob**
- [x] Interstitials — none in the first 5 dives, then at most every 3 dives and 150 s apart, never after a dive with a rewarded ad, never for Remove Ads owners; only between dives
- [~] Purchases — `remove_ads`, `starter_pack` (non-consumable), `pearls_500/1500/4000` (consumable). Tokens remembered before consuming; pending payments granted on completion. **Never run against live Play Billing**
- [ ] Create the five products in Play Console; licence-tester purchase / cancel / pending / restore tests

## E. Final device testing (needs real devices)

- [ ] **Never run on a physical Android phone** (per `store/PUBLISHING.md`)
- [ ] Touch-joystick feel at 60 and 120 Hz; frame rate in the Trench with a boss and dense swarms on a low-end phone
- [ ] Back button: pause → resume, menus, quit
- [ ] Kill the app mid-dive → relaunch: menu shows "cut off at … m" and the pearls arrived (this audit's change)
- [ ] Audio after backgrounding; vibration toggle
- [ ] Web build (optional, `build/web`) on iPhone Safari memory

## F. Publishing documentation

| Field | Value |
|---|---|
| Final title | Lurelight |
| Tagline | Whirl your glowing lure through the deep. |
| Key features | One-thumb lure-whirling arcade action · 6 creature types, elites, 3 bosses, endless trench · 11 visual mutations · 4 fish with different lure handling · pearl-shop upgrades · daily dive with streaks · 25 awards · 7-day rewards |
| Category | Arcade (tags: Action, Roguelite, Casual) |
| Suggested rating | Everyone 10+ / PEGI 7 (subject to IARC) |
| Required assets | icon ✔, feature graphic ✔, screenshots ✔, privacy policy URL ✘ |

### Outstanding publishing requirements

| Severity | Item |
|---|---|
| Critical | Run `--uitest` (with and without `--fakeads --fakestore`) on the audited code — not possible in this audit |
| Critical | First run on a physical Android phone |
| Critical | Host privacy policy; set `PRIVACY_URL`; real AdMob ids, `TEST_MODE := false` for the production track |
| High | Play products created and licence-tested; consent form tested with an EEA test device |
| High | Data safety / ads / content rating; closed-test requirement |
| Medium | Confirm the export template's target SDK meets Play's requirement |
| Low | Idle reef / Play Games leaderboards (roadmap) |
