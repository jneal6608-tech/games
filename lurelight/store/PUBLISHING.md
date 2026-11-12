# Publishing Lurelight on Google Play

A checklist from "nothing" to "live", in order. Menu names in Play Console and AdMob move around from time to
time; if one is not where this says, search the console for the term.

**What costs money:** only the one-time US$25 Google Play developer registration (step 1). AdMob, Play Billing,
the pre-launch report and closed testing are free. Google keeps 15% of purchases (on the first US$1M a year).

**What has and has not been tested** (as of v0.2.0):

| | Status |
| --- | --- |
| Game logic, menus, saving, shop, fish, awards, daily rewards | Automated test passes on desktop (`--uitest`) |
| Ad and purchase *flows* (revive, double pearls, reroll, pacing, grants) | Automated test passes with simulated ads and store (`--fakeads --fakestore`) |
| Release `.aab` / `.apk` | Build, are signed with the release key, and contain both plugins. The game files packed inside pass the automated test on desktop |
| **Running on a real Android phone** | **Never done.** No phone or emulator was available |
| **Real AdMob ads, the consent form, real Play purchases** | **Never run.** They need a real device and, for purchases, an app in Play Console |

So treat the first internal-testing upload (step 5) as the first real test of the app, and expect to fix things.

---

## 0. Before anything: decide the permanent things

1. **App name and package ID.** The package ID (`com.lurelight.game`) can never be changed after the first
   upload. To change either: `package/unique_name` and `package/name` in `export_presets.cfg` (both Android
   presets) and `config/name` in `project.godot`. A web search found no existing game called "Lurelight"
   (closest: "Lorelight", a history app); that is not a trademark search.
2. **Back up the release keystore**: `lurelight-release.keystore` and `keystore-info.txt` (password inside).
   Every update must be signed with it. With Play App Signing (the default) a lost upload key can be reset by
   Google support, but it takes days; just keep two copies.

## 1. Create the accounts

1. **Google Play developer account**: https://play.google.com/console/signup . US$25 once. Choose *personal*
   unless you have a registered business. Identity verification can take a few days.
   A personal account created after November 2023 must run a **closed test with at least 12 testers for 14
   days** before it may publish to production (step 6).
2. **AdMob account**: https://admob.google.com . Free. Payments start once earnings pass the threshold
   (US$100) and you have added tax and bank details.

## 2. Create the app in Play Console

1. *Create app*: name, language, **Game**, **Free**.
2. Work through *Set up your app* (Policy > App content):
   - **Privacy policy**: needs a public URL. Free way: put `store/privacy-policy.html` on GitHub Pages or as an
     itch.io page. Fill in the three `[PLACEHOLDERS]` in it first (also in `privacy-policy.md`). Then put the
     same URL in `PRIVACY_URL` at the top of `src/ui/screens.gd` so Settings shows a PRIVACY POLICY button.
   - **Ads**: *Yes, my app contains ads*.
   - **App access**: all functionality available without restrictions.
   - **Content rating**: questionnaire, category *Game*. Cartoon creatures being bopped by a lure, no blood:
     answer the violence question as mild / cartoon. No user interaction, no location sharing, digital purchases yes.
   - **Target audience**: **13 and over**. Do not include under-13s: that pulls the app into the Families
     policy, with stricter ad rules than this build follows.
   - **Data safety**: see the table below.
   - **Advertising ID**: *Yes*, used for *Advertising or marketing* (the manifest declares
     `com.google.android.gms.permission.AD_ID`).
   - Government apps, financial features, health: No.
3. *Store listing*: copy from `store/listing.md`; upload the icon, feature graphic and screenshots.

### Data safety answers

The game itself collects nothing; everything below is collected by the AdMob SDK. Google's own guide for this
form: https://developers.google.com/admob/android/privacy/play-data-disclosure (check it, the list changes).

| Question | Answer |
| --- | --- |
| Does your app collect or share user data? | Yes |
| Is all data encrypted in transit? | Yes |
| Can users request deletion? | No account exists; say data is not tied to an account |
| Location > Approximate location | Collected, shared. Purpose: Advertising, Analytics |
| App activity > App interactions | Collected, shared. Purpose: Advertising, Analytics |
| App info and performance > Crash logs, Diagnostics | Collected, shared. Purpose: Analytics |
| Device or other IDs | Collected, shared. Purpose: Advertising, Analytics, Fraud prevention |
| Financial info > Purchase history | Not collected by the app (Google Play handles purchases) |

## 3. Set up AdMob (test ads work without this; real ads need it)

1. AdMob > Apps > *Add app* > Android. If the app is not on Play yet choose "not listed"; link it later.
   Note the **App ID** (`ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`).
2. Create two **ad units**: one *Rewarded*, one *Interstitial*. Note both unit IDs (`.../ZZZZZZZZZZ`).
3. Put them in the project:
   - `project.godot`: add at the end
     ```
     [admob]

     general/android/app_id="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"
     ```
     (or in the Godot editor: Project Settings > General > Admob > Android > App Id).
   - `src/autoload/ads.gd`: fill `AD_UNITS` with the two unit IDs and set `TEST_MODE := false`.
4. **Never tap your own live ads.** Before playing a build with real IDs, register your phone as a test device:
   AdMob > Settings > Test devices. Tapping live ads yourself can get the account suspended.
5. AdMob > *Privacy & messaging* > **European regulations**: create and publish a GDPR consent message for the
   app. The game already asks Google's consent service at start-up and shows the form where required; without a
   published message there is simply no form, and EEA / UK users get limited ads.
6. **app-ads.txt**: AdMob asks for a file at `https://<your developer website>/app-ads.txt` containing the line
   it shows you. The website is the one in your Play listing's contact details. GitHub Pages works.
   Without it ads still serve, but earn less.

Keep `TEST_MODE := true` for the internal and closed test builds if you have not done 4 yet.

## 4. Create the in-app products

Play Console > Monetize > Products > In-app products (available after the first build is uploaded):
create all five products (`remove_ads`, `starter_pack`, `pearls_500`, `pearls_1500`, `pearls_4000`) exactly as
listed in `store/listing.md`, and **activate** them.
Then Settings > License testing: add your testers' Google accounts so their purchases are free test purchases.
Until the products exist and are active, the game hides its STORE button; nothing else is affected.

## 5. Build, upload, and get the first real-device test

```bash
tools/setup_toolchain.sh        # once per machine
```

```bash
GODOT=~/.local/lurelight-toolchain/Godot_v4.7-stable_linux.x86_64 KEYSTORE=/path/lurelight-release.keystore KEYSTORE_PASS='...' tools/build_release.sh
```

That writes `build/lurelight-release.aab` (for Play) and `build/lurelight-release.apk` (to install by hand).
For every later upload, raise `version/code` by one in **both** Android presets in `export_presets.cfg`, and
keep `version/name` there and `config/version` in `project.godot` in step.

1. Testing > **Internal testing** > create release > upload the `.aab`. Accept Play App Signing when asked.
2. Add yourself and anyone with an Android phone as internal testers; they install from the opt-in link.
3. Within an hour or so, open **Testing > Pre-launch report**. Google runs the build on several real phones
   and shows crashes, screenshots and performance. This is the first evidence of how the game behaves on
   Android. Look specifically for:
   - crashes or a black screen at launch (rendering or plugin problems)
   - memory warnings on the low-end devices (the dive can have 160 creatures on screen)
   - whether its screenshots show the menu and a dive
4. If you can borrow any Android phone: install from the internal test link and play ten minutes. Check, in
   order: the game starts; touch steering feels right; sound; vibration; a test ad appears when you tap
   WATCH AD (it is labelled "Test Ad"); after the ad you really are revived; the STORE button appears and a test
   purchase completes ("test card, always approves"); Remove Ads survives reinstalling the app.

Report anything odd back and it can be fixed before the closed test.

## 6. Closed test (required for new personal accounts)

1. Testing > **Closed testing** > create a track, upload the same `.aab` (or a fixed one).
2. Add at least **12 testers** by Google account email (friends, family, r/AndroidClosedTesting and similar
   communities trade tests). They must opt in and stay opted in for **14 days in a row**.
3. After 14 days: Dashboard > *Apply for production access*. Google asks what you learned from the test;
   answer honestly and specifically. Review takes up to a week or so.

## 7. Production

1. Production > create release > promote the tested build (or upload a new `.aab` with a higher version code).
2. Choose countries. A staged roll-out (20% first) is a cheap way to catch problems.
3. Before the production build: real AdMob IDs in, `TEST_MODE := false`, GDPR message published,
   `PRIVACY_URL` filled in, products active.
4. After launch, link the Play listing to the AdMob app (AdMob > Apps > your app > App settings).

## After launch

- **Crashes**: Play Console > Quality > Android vitals.
- **Updates**: bump the version code, `tools/build_release.sh`, upload to production (reviews take hours to days).
- **iOS**: the Godot project and the AdMob plugin both support it, but it needs a Mac with Xcode and Apple's
  US$99-a-year programme, and StoreKit instead of Play Billing in `src/autoload/store.gd`.
