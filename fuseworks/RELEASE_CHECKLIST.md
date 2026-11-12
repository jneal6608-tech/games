# Fuseworks — Release Checklist

Status legend: `[x]` verified in this repo · `[ ]` not done / needs you · `[~]` partly done or done but unverified.
Last audit: 12 Nov 2026. Platform: Android via Capacitor 8 (TypeScript + Vite web app in `src/`).
The step-by-step publishing guide is `docs/PUBLISHING.md`; this file is the release gate.

## A. App store assets

- [x] App icon 512×512 — `store/icon-512.png`; launcher icons in `android/app/src/main/res/mipmap-*`
- [x] Title — **Fuseworks** (listing title in `store/listing.md`)
- [x] Short + full description — `store/listing.md`
- [x] Feature graphic 1024×500 — `store/feature-graphic-1024x500.png`
- [x] Phone screenshots — `store/screenshots/` (regenerate with `tools/screenshots.mjs`)
- [ ] Tablet screenshots — optional
- [x] Consistent branding — night-sky palette, warm "Fuseworks" wordmark, same shell icons in game and store art

## B. Technical release requirements

- [x] Production build — `npm run build` (type-check + Vite), `npm run android:release`
- [ ] **Application id final** — `com.fuseworks.game` (see `docs/PUBLISHING.md` §0 for every place it appears)
- [ ] **AdMob App ID** (`android/app/src/main/res/values/strings.xml`) and **rewarded unit** (`src/config.ts`) are Google test ids; `adsTestMode: true`
- [x] No debug interfaces — no `window` test hooks or console logging in `src/`; simulated ads/purchases only exist in the browser
- [x] **Simulated purchases are now limited to localhost / `?dev=1`** (this audit). Before, any hosted web build let players "simulate" Premium and ticket packs for free
- [x] No secrets committed — keystore and `keystore.properties` are git-ignored
- [x] Asset paths — Vite relative base; bundled into the APK by `cap sync`
- [x] Save integrity — **progression now has a mirrored backup copy** and loads from it if the main copy is unreadable (this audit; `e2e/integrity.mjs`). Purchases are saved before they are acknowledged with Google
- [x] Permissions — INTERNET only (plus what the AdMob/Billing libraries merge in)
- [x] Target SDK 36
- [ ] R8/minify is off for release (`minifyEnabled false`) — safe for Capacitor, larger APK. Optional to enable with keep rules
- [ ] Gradle release build + install on a device after this audit (no Android SDK in the audit container)

## C. Legal and compliance (not verified — needs you)

- [ ] **Privacy policy** — draft `docs/privacy-policy.md` / `.html` has `[DATE]`, `[YOUR NAME OR COMPANY]`, `[YOUR SUPPORT EMAIL]`; review and host it
- [ ] **`privacyPolicyUrl` and `supportEmail` in `src/config.ts` are placeholders** (`example.com`) — Critical
- [x] Ad privacy choices — Settings button calls the UMP privacy-options form (native only)
- [ ] Data safety — advertising ID (AdMob), purchase history (Play)
- [ ] Ads declaration: "Contains ads: Yes" (rewarded only, player-initiated)
- [ ] Content rating (IARC) — fireworks theme, no violence. Suggested Everyone / PEGI 3
- [x] Third-party licences — Capacitor (MIT), capacitor-community/admob (MIT), capgo native-purchases (MPL-2.0 — keep its licence notice), no third-party art/audio
- [ ] Name / trademark check for "Fuseworks"

## D. Monetization readiness

- [~] Rewarded ads only, always player-initiated: Encore (+1 Match), double tickets, free market reroll. **No interstitials.** Flow tested with the browser stand-in; never against live AdMob
- [x] Premium owners never load ads
- [~] Purchases — `premium_unlock` (non-consumable), `tickets_60/200/500` (consumable); not acknowledged/consumed until the reward is saved; interrupted purchases reconciled at launch/resume. Logic unit-tested; **never run against live Play Billing**
- [ ] Create the four products in Play Console; licence-tester purchase / cancel / pending / restore tests

## E. Final device testing (needs real devices)

- [x] Touch suite across 6 phone profiles (320–480 px wide) — 309/310 checks; the one miss is a **4×-throttled CPU frame-rate target on the largest screen (28 fps vs 30)**, a headless software-rendering measurement
- [x] Portrait only
- [x] 20-burst chain stays inside the particle budget; adaptive quality drops effects under load
- [ ] Physical low-end phone: chain frame rate, heat, 30-minute session
- [ ] Back button, app switch mid-chain, kill/relaunch mid-run (run is saved; verify on device)

## F. Publishing documentation

| Field | Value |
|---|---|
| Final title | Fuseworks |
| Tagline | Build the sky. Light one fuse. |
| Key features | Place fireworks on a grid, light one fuse and watch the chain · 6-night festival roguelike with a Market and charms · 5 stakes · Daily Show with medals · Endless mode · Workshop unlocks and skies · no forced ads |
| Category | Puzzle (tags: Roguelike, Strategy, Casual) |
| Suggested rating | Everyone / PEGI 3 (subject to IARC) |
| Required assets | icon ✔, feature graphic ✔, screenshots ✔, privacy policy URL ✘ |

### Outstanding publishing requirements

| Severity | Item |
|---|---|
| Critical | Host privacy policy; set `privacyPolicyUrl` + `supportEmail` |
| Critical | Real AdMob App ID + rewarded unit; `adsTestMode: false` only for the Play-track build |
| Critical | Signed release build installed and played on a physical phone |
| High | Play products created and licence-tested |
| High | Data safety / ads / content rating forms; closed-test requirement |
| Medium | Frame rate on the largest low-end screens during 20-burst chains (borderline in throttled tests) |
| Low | Enable R8 with Capacitor keep rules; tablet screenshots |
