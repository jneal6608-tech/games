# Lurelight: handoff for the next session

Read this whole file before doing anything. It records what the owner asked for, what was decided and why, the
current state of the game, what the owner reported from playing it, and what is left. `README.md` covers how to
run, build and test.

> **This repository is also an animation studio.** The root `CLAUDE.md` (STYLE.md, voiceovers, storyboards,
> `/make-video` and so on) applies to the explainer videos only. None of it applies to `games/lurelight/`.

---

## 1. The owner and the goal

- The owner is building a **portfolio of original mobile games**. Their first game was a puzzle game; this second
  one had to be a **different genre** with a **realistic chance of earning revenue**.
- The brief asked for an elite independent studio's approach: market research, 12 concepts scored, the best one
  picked and approved, then the **actual game built**, not a prototype. That means complete gameplay, touch
  controls, menus, settings, progression, saves, audio, effects, balance, achievements, monetization
  infrastructure and Android compatibility.
- **Final deliverables required:** playable Android game, full source, original assets, installable test APK,
  Android release build, app icon, store screenshots, Google Play description, monetization implementation and
  publishing instructions. Keep costs near zero, and keep the project easy to continue developing.
- **Their traffic plan is short-form video** (TikTok, Shorts, Reels), as with their first game. Design for
  footage: the game should read instantly in a clip.
- **Working rules they set:**
  - Decide routine things yourself.
  - Ask before: significant creative decisions, changing core gameplay, or anything that costs money.
  - Don't interrupt constantly.
  - Show playable builds when possible.
  - Implement their feedback directly.
  - **Never claim something was tested if it wasn't.**
- **They test on an iPhone 13 Pro in Safari**, via a browser build uploaded to a draft itch.io page. They have
  **no Android phone** (confirmed in the 0.2.0 session). Nothing has run on real Android hardware yet.

## 2. What was decided

### Concept (approved)

**Lurelight** is an arcade survival roguelite. You are a small anglerfish in the deep sea and your glowing lure is
your only weapon:
- Drag anywhere to swim, using a floating joystick.
- Circling your thumb whirls the lure around you; faster whirls hit harder.
- Kills drop plankton (XP); each level-up offers 3 mutations, which visibly change the lure.
- Dive deeper through zones, each ending in a boss; the dive is endless.

It won the concept scoring (43/50, ahead of a single-tower roguelite defence and a snake-train auto-shooter). The
reasons:
- A mechanic that reads in a 3-second clip.
- Skill-based moment-to-moment play, unlike auto-firing survivor games.
- A proven genre whose leaders players criticise for monetization and late-game grind.

Idle and tycoon concepts earn more per player but are poor for short-form clips.

### Engine: Godot 4.7, not Unity

- Unity's download servers are blocked from the cloud environment, and Unity Personal needs an interactive login.
- Godot is free with no revenue share or splash screen, and is fully text-based, so it suits AI-driven work.
- The same project exports to Android, to the web (the owner's iPhone testing) and, later, to iOS from a Mac.

### Business model (agreed in principle, not built yet)

- **Rewarded ads, optional only:** revive once per dive, double pearls at the end, reroll mutations.
- **Interstitials:** at most one between dives, never mid-run, none in the first few sessions.
- **Purchases:** remove ads, cosmetic fish and lure skins, a one-time starter pack.
- **Deliberately excluded:** energy timers and gear gacha, the genre's most complained-about systems.
- **Idle layer, planned for later:** a reef that produces pearls while away, with a "double it" rewarded ad. It is
  for monetization and retention only and doesn't appear in clips.
- Be honest with the owner that revenue depends on getting players; no model earns without traffic.

### Difficulty

The owner finds the game "pretty fun, kinda hard". They like that the controls are unusual and want it to **stay
challenging**. The agreed principle: difficulty from mastering the controls is good, deaths that feel unfair are
not.

## 3. Current state: version 0.2.0 (feature-complete for a first release)

**Built in 0.1.x (first playable):** fish and lure physics, six creatures plus elites, three bosses, four zones
then endless, 11 mutations, menu / level-up / pause / settings / end card, daily dive, clip mode, atomic JSON
save with cut-off detection, original SVG art, generated audio, OFL fonts.

**Added in 0.2.0:**
- **Progression** (`src/game/meta.gd` holds every number):
  - Pearl shop: Dense Lure (+4% damage x5), Bright Bait (+8% pickup x5), Pearl Diver (+10% double-pearl chance
    x5), Second Thoughts (reroll x2), Thick Hide (+1 heart x2), Head Start (free mutation at the start).
    About 4,000 pearls in total; a dive pays roughly 40 to 150 including the new depth bonus (depth / 100).
  - Fish: Lantern (default), Anchorjaw (heavy lure, slow response, 5 hearts, 300), Glasswhip (long light lure,
    fast response, 3 hearts, 300), Gemini (two lures, 500). Handling differs through `Lure.response` (scales
    ALIGN and both drags together, so the top whirl speed is unchanged) and `keep_bonus`. Art is recoloured
    from the base fish by `tools/gen_fish.py`.
  - Lure glows (cosmetic): three for 120 pearls each; Aurora comes with the Starter Pack.
- **Retention:** 25 local awards with pearl rewards (toast on unlock, AWARDS screen), 7-day daily reward
  (pops up on the menu once a dive has been finished), daily-dive streak bonus.
- **Monetization** (all behind two autoloads, so the game never touches an SDK directly):
  - `Ads` (`src/autoload/ads.gd`): rewarded revive (once per dive, dives of 40 s or more), double pearls on the
    end card, one ad reroll per level-up, double daily reward. Interstitials only between dives: none in the
    first 5 dives, then at most one per 3 dives and per 150 s, none after a dive with a rewarded ad, none with
    Remove Ads. `TEST_MODE := true` and Google's public test units; real ids are deliberately empty.
  - `AdmobBackend`: Poing Studios AdMob plugin v5.1.0 (`addons/admob`), with the UMP consent flow first.
  - `Store` (`src/autoload/store.gd`): official Godot Google Play Billing plugin 3.3.0. Products `remove_ads`
    and `starter_pack` (one-time, restored from Play on every launch) and the consumable pearl packs
    `pearls_500` / `pearls_1500` / `pearls_4000` (added at the owner's request; consumed after payout, with
    granted purchase tokens remembered so an interrupted purchase is finished once, never paid twice). The STORE button is hidden until
    Play returns prices, so nothing shows before the products exist in Play Console.
  - Web and desktop have neither backend: no ad buttons, no store. `--fakeads` / `--fakestore` simulate them.
- **Release:** Gradle build, `tools/build_release.sh` (signed `.aab` + `.apk`), `tools/make_keystore.sh`,
  store listing, 8 screenshots, feature graphic, privacy policy, `store/PUBLISHING.md`.
- Android: versionCode 5, 0.2.0, package `com.lurelight.game`, minSdk 24, target 36.

**How it was tested, and what was not** (keep this honest when reporting to the owner):
- `--uitest` (desktop, headless): every screen, touch, saving, shop, fish, glows, awards, daily reward and
  streak rules. Passes. With `--fakeads --fakestore` it also covers revive, double pearls, ad reroll,
  interstitial pacing and purchase grants. Passes.
- The same test passes when run against the files unpacked from the release APK's `assets/` (this caught an
  export filter that had stripped a script the ad plugin needs).
- `--bench`: the default fish is unchanged from 0.1.3 at 30 / 60 / 120 fps; per-fish results are printed too.
- Balance: 12 automated dives per fish, no shop upgrades. Every fish's median dive ends at the second boss
  (2,455 m); Glasswhip has the lowest ceiling, as intended for a 3-heart fish.
- Web build: loads and starts a dive in headless Chromium with no script errors.
- **Not tested: anything on a real Android device or emulator** (none available, no KVM in the cloud
  container). The AdMob SDK, the consent form, real ad callbacks and the Play Billing flow have never executed.
  The billing response field names were read out of the plugin binary, not seen live. Expect fixes after the
  first internal-test upload.

**Difficulty past the Trench (owner's request, after 0.2.0):** 0 to 4,500 m is unchanged, because that stretch
is where players separate by skill. From 4,500 m `World.pressure()` jumps to 2, then grows as 2 + 1.5d + 0.5d^2
(d = zones past 4,500 m) and drives enemy speed, spawn rate, the share of dangerous creatures, enemy health,
elite frequency (pairs from 6,000 m, threes from 9,000 m) and the squid limit. Knobs: `DEEP_*` at the top of
`world.gd`. The 165-creature cap is deliberately unchanged (phone performance).

**Not built:** the idle reef, Play Games sign-in / leaderboards, iOS.

## 4. What the owner reported from playing it (all fixed unless noted)

1. **"Kinda hard, but the controls add to the experience."** Keep it challenging.
2. **Best about 2,000 m after many tries.** Darters killed them most but were "dodgeable most the time". Squid
   felt like "nothing I could do" when overwhelmed. **Fixed in 0.1.1:**
   - Squid now charge for 0.7 s with a red aim line before firing, and the aim locks so moving dodges the shot.
   - A lure hit cancels a squid's charge.
   - At most one squid shot every 0.6 s across all squid, with squid capped per zone (3, 3, 4, 5).
   - Shots are bigger (radius 19), with a dark rim, and expire after 4.5 s.
   - The owner then said: "I like the change its good."
3. **Crash on iPhone Safari at about 2,000 m, later about 2,500 m.** The page reloads to the game's menu with no
   error message. Slightly choppy before it. Never reproduced on desktop or in desktop Chromium (memory flat, no
   errors up to 4,400 m).
   - Diagnosis: iOS Safari kills pages whose memory has to grow. A browser trace showed the game's memory growing
     mid-dive right at the 2,455 m boss.
   - **0.1.2:** particles became plain data drawn by `Fx` instead of a new node per hit, and pop-in text scales
     with a transform instead of building a new font size each frame.
   - **0.1.3:** the web build reserves 288 MB at load (`html/head_include` in the Web preset), so memory never
     grows during a dive. Verified in Chromium: no growth through the boss and into the Abyss. A dive cut off by
     a kill now shows "Your last dive was cut off at X m" on the menu.
   - **The owner's decision: the web build is only a test tool, and they're not worried if it still crashes. The
     APK is the product.** Don't spend effort on the web crash unless the owner asks. The cause (browser memory
     growth) doesn't apply to a native Android app.
   - **The APK has still never run on a real Android phone**, so it's unverified, not known-good. Plan to verify
     it through Google Play's free **pre-launch report**, which runs any build uploaded to a testing track on
     real devices and reports crashes with screenshots, plus the 12 closed-test testers. Include both in the
     publishing guide, and keep an eye out for memory problems on low-end phones.
   - The choppiness on iPhone Safari is a separate issue. Offering fewer creatures on screen later in a dive is a
     possible fix.

## 5. Remaining work

1. **Owner decisions still open** (asked at the end of the 0.2.0 session; check for an answer):
   - Final name and package ID. Working values are "Lurelight" and `com.lurelight.game`; the package ID is
     permanent after the first Play upload. A web search found no game called Lurelight (not a trademark check).
   - Prices for the two products (suggested US$2.99 and US$1.99).
2. **Owner actions** (`store/PUBLISHING.md` walks through them): pay the US$25 Play registration, create the
   AdMob app and ad units, host the privacy policy, upload to internal testing, read the pre-launch report,
   run the 12-tester / 14-day closed test.
3. **After the first real-device results:** fix whatever the pre-launch report and testers find. Likely
   suspects: plugin initialisation, the consent form, billing response parsing in `Store._on_details` /
   `_on_purchases`, performance on low-end phones (spawn cap is 165 creatures; lowering it is the quick fix).
4. **Before production:** real AdMob ids and `TEST_MODE := false` in `ads.gd`, `[admob]` app id in
   `project.godot`, `PRIVACY_URL` in `src/ui/screens.gd`, version code bump.
5. **Later:** idle reef, Play Games achievements (the local list in `meta.gd` maps one to one), iOS.

**The release keystore** was generated in the 0.2.0 session and sent to the owner with its password
(`lurelight-release.keystore`, `keystore-info.txt`). It is not in git and the cloud container is temporary:
a new session needs the owner to provide it (or `tools/make_keystore.sh` makes a new one, which is only
acceptable before the first Play upload).

## 6. Technical notes that will save time

- **Lure physics** (`src/game/lure.gd`): the lure streams behind the fish's swim direction and has angular
  momentum, so circling the thumb whirls it.
  - Constants: `ALIGN`, `DAMP`, `DAMP_QUAD`, `FULL_SPEED`.
  - Realistic rope models were tried first and rejected: they only whirled on slow, wide circles.
  - After changing lure physics, run `--bench`. Thumb circles at 6.5–8 rad/s should give about 1,400–1,800 lure
    speed, and results must match at 30, 60 and 120 fps.
- **Damage scaling:** `f = (lure.speed - 250) / 1150`. Armour needs speed 1,450 or more; Whipcrack needs 1,900 or more.
- **The stalk itself hits**, at half damage. That was a deliberate fix for early swarms reaching the fish inside the
  whirl.
- **Balance knobs** are at the top of `src/game/world.gd`: the spawn table, zone lengths, `_hp_mult`, spawn rate and
  cap, the squid limits, and a heart pity drop (at most one heart per 40 s while wounded).
  - Last balance batch (automated player, 10 dives): median dive about 2:20, most reach the Midnight Zone, a few
    reach the Abyss or Trench.
  - The automated player is a decent proxy for a good human but dodges shots perfectly, so it can't judge whether
    shots feel fair.
- **Performance and memory:** don't create nodes per hit or kill. Use `Fx.burst` (data particles) and `Items.text`.
  Don't vary font sizes per frame; scale with `draw_set_transform`.
- **Dev flags** (see README): `--autoplay`, `--log`, `--hurtlog`, `--quit-after=N`, `--bench`, `--uitest`,
  `--screen=menu|levelup|end|pause|settings`, `--shots=DIR --shot-times=…`, `--zone=N`, `--hearts=N`.
  - Also: `--fish=`, `--nometa`, `--fakeads`, `--fakestore`, `--zone-t=`, `--muts=` and more `--screen=` names (README).
  - A texture first loaded inside `_draw` is not uploaded in time for that frame: load in `_init` / `_ready`.
  - Headless balance run:
    `godot --headless --path . --fixed-fps 60 -- --autoplay --log --quit-after=600`
  - Screenshots or video need a display: `tools/run.sh` (xvfb). `RES=540x960` is much faster; `--write-movie` records.
- **Gotchas:**
  - After adding a new `class_name` script, run `godot --headless --path . --import` once or other scripts can't
    resolve it.
  - GDScript forbids a `var i` declared twice in one function scope, including a loop variable.
  - `pkill -f Godot_v4.7` kills your own shell, because the command line contains the pattern.
  - The web build is single-threaded with stream audio (`audio/general/default_playback_type.web=0`).
- **Toolchain:** nothing is installed in a fresh cloud container. Run `tools/setup_toolchain.sh` (about 1.6 GB: Godot
  4.7, Android and web templates, Android SDK, debug key), then `GODOT=… tools/build_apk.sh`.
  - Android is now a **Gradle build**. `tools/install_android_template.sh` (called by the build scripts) unpacks
    Godot's template into `android/`. The first build downloads Gradle and Maven libraries; Maven Central
    sometimes answers 429, and simply retrying works.
  - Debug and release APKs are about 160 to 175 MB because Gradle stores the engine library uncompressed for
    both CPU types; the `.aab` is 62 MB and Play delivers one CPU type per phone.
  - `export_presets.cfg` has three presets: `Android` (apk), `Web`, `Android AAB`. Keep the two Android ones in
    step (version, package, icons). Never exclude `addons/admob/internal` from export: runtime scripts preload it.
  - `addons/admob/ios/bin/package.gd` is a placeholder that stops the plugin downloading iOS binaries on every
    headless start.
  - The AdMob plugin gives each ad a `full_screen_content_callback`; the reward arrives through
    `OnUserEarnedRewardListener` before the dismissed callback. Read `addons/admob/gdscript/src/api/` for the API.
  - GitHub release downloads and dl.google.com worked from the cloud environment.
  - Builds go to `build/`, which is git-ignored. Send the APK or web zip to the owner as files.
- **Publishing a web build for the owner:**
  - Zip the contents of `build/web/` and send it.
  - They upload it to their draft itch.io HTML page with a 540 × 960 viewport, "Mobile friendly" and "Fullscreen
    button" ticked.
- **Version bumps:** `version/code` and `version/name` in `export_presets.cfg`, plus `config/version` in
  `project.godot`.
- **Git:** 0.1.x was on branch `claude/youthful-cerf-anxxpx`; 0.2.0 is on `claude/beautiful-rubin-mjrmqd`, which
  starts from it. No pull request was opened. Ask before opening one.
