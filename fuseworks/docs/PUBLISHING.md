# Publishing Fuseworks on Google Play

A step-by-step guide for a first-time publisher. Google changes its consoles and fees; where a figure or screen name matters, confirm it on Google's own page.

## 0. Pre-release checklist (do not skip)

| # | What | Where | Currently |
| --- | --- | --- | --- |
| 1 | Application ID (permanent after first upload) | `capacitor.config.ts` `appId`, `android/app/build.gradle` `namespace` + `applicationId`, `android/app/src/main/res/values/strings.xml`, and the Java package folder | `com.fuseworks.game` |
| 2 | AdMob **App ID** | `android/app/src/main/res/values/strings.xml` → `admob_app_id` | Google's public test ID |
| 3 | AdMob **rewarded ad unit ID** | `src/config.ts` → `rewardedAdUnitId` | Google's public test ID |
| 4 | Turn ad test mode off (only after 2 and 3) | `src/config.ts` → `adsTestMode: false` | `true` |
| 5 | Privacy policy URL | `src/config.ts` → `privacyPolicyUrl` | placeholder |
| 6 | Support email | `src/config.ts` → `supportEmail`, and `docs/privacy-policy.*` | placeholder |
| 7 | In-app products exist and are active: `premium_unlock`, `tickets_60`, `tickets_200`, `tickets_500` | Play Console | not created |
| 8 | Version | `android/app/build.gradle` `versionCode` (+1 every upload), `versionName`; `src/config.ts` `version`; `package.json` | 1 / 1.0.0 |
| 9 | Signing key backed up in two places | `android/fuseworks-upload.keystore` + `android/keystore.properties` | generated, not in git |

Never click your own live ads. AdMob bans accounts for it. Keep test mode on until you are testing a build from a Play test track with your device registered as a test device.

## 1. Accounts (about an hour, plus verification waiting time)

1. **Google Play Console**: sign up at play.google.com/console, pay the one-time registration fee (US$25 at the time of writing), complete identity verification. A **personal** account created since November 2023 must run a closed test before it can publish (step 6). An organisation account is exempt but needs a registered business.
2. **Google AdMob**: sign up at admob.google.com with the same Google account. Add an app (Android, "not yet published" is fine), then create one **Rewarded** ad unit. Note the App ID (`ca-app-pub-…~…`) and the ad unit ID (`ca-app-pub-…/…`).
3. **Privacy policy page**: put `docs/privacy-policy.html` online. Free option: a public GitHub repository with GitHub Pages enabled. Fill in your name and email in the file first.

## 2. Put your IDs into the game and rebuild

Edit the files in the checklist, then:

```bash
npm install
```

```bash
npm test
```

```bash
npm run build
```

```bash
npm run e2e
```

```bash
npm run android:release
```

Outputs:
- `android/app/build/outputs/bundle/release/app-release.aab` → upload this to Play.
- `android/app/build/outputs/apk/release/app-release.apk` → install this directly on a phone.

Requirements: Node 22+, JDK 21, Android SDK with `platforms;android-36` and `build-tools;36.0.0`, and `android/local.properties` containing `sdk.dir=/path/to/android-sdk`.

### The signing key
`android/keystore.properties` points at `android/fuseworks-upload.keystore`. Both are git-ignored on purpose. Back them up. With Play App Signing (the default), this is only your **upload** key: if you lose it, Google can reset it after an identity check, but it is a slow process. To make your own instead:

```bash
keytool -genkeypair -v -keystore android/my-upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Then update the four lines in `android/keystore.properties`.

## 3. Create the app in Play Console

Create app → name **Fuseworks: Firework Roguelike**, default language English, **Game**, **Free**. Then work through "Set up your app":

| Form | Answer |
| --- | --- |
| Privacy policy | Your hosted URL |
| App access | All functionality available without special access |
| Ads | **Yes, contains ads** |
| Content rating (IARC questionnaire) | Category: Game. No violence, no sexual content, no profanity, no drugs, no gambling (no real-money or simulated gambling: coins and tickets cannot be bought and nothing is wagered). Fireworks are depicted non-realistically. No user-to-user communication. Does not share location. Has in-app purchases. Expected result: Everyone / PEGI 3. |
| Target audience | **13 and over only.** Do not select under-13 groups: that would trigger the Families policy and stricter ad rules. Answer "No" to "could appeal to children unintentionally" only if you are comfortable; if Google asks, the game is not designed for or marketed to children. |
| News app / Health / Government / Financial | No |
| Advertising ID | **Yes**, the app uses it. Purpose: Advertising or marketing (via the Google Mobile Ads SDK). |
| Data safety | See section 4 |

## 4. Data safety form

The game itself collects nothing and has no server. The declarations below exist because of the Google Mobile Ads SDK and Google Play Billing. Check them against Google's current "Data safety guidance for the Google Mobile Ads SDK" page before submitting.

- Does your app collect or share any of the required user data types? **Yes.**
- Is all collected data encrypted in transit? **Yes.**
- Do you provide a way to request deletion? Data is not tied to an account you control; state that users can reset their advertising ID in Android settings, and that game progress is deleted by clearing app data or using "Erase progress" in settings.

| Data type | Collected | Shared | Purpose | Required? |
| --- | --- | --- | --- | --- |
| Device or other IDs (advertising ID) | Yes | Yes | Advertising or marketing, fraud prevention | Optional for Premium owners; otherwise collected when ads are requested |
| App interactions (ad views and taps) | Yes | Yes | Advertising, analytics for the ad network | Same |
| Approximate location (derived from IP by the ad SDK) | Yes | Yes | Advertising | Same |
| Diagnostics (ad SDK performance data) | Yes | Yes | Analytics | Same |
| Purchase history | Processed by Google Play, not by the app | No | App functionality (unlock Premium) | — |

Game saves (progress, settings) stay on the device (and in the user's own Android backup, if they have it enabled) and are not transmitted by the app.

## 5. In-app products

Play Console → Monetise → Products → In-app products → Create:
- Product ID: **`premium_unlock`** (must match `src/config.ts` exactly; cannot be changed later).
- Name: Fuseworks Premium. Description: "No ads, free Encore every run, doubled tickets, the Aurora sky."
- Price: US$3.99, let Play convert other countries. Activate it.

You need a build uploaded to at least an internal testing track before products can be tested, and you need a payments profile. Add your own Google account under Settings → License testing so test purchases are free.

Also: AdMob → your app → link it to the Play listing once published, and add an `app-ads.txt` file to the root of the developer website named in your listing (AdMob shows the exact line to paste).


Then create the three **ticket packs** the same way. They are consumables: the app consumes each purchase after granting the tickets, so a pack can be bought again.

| Product ID | Name | Description | Price |
| --- | --- | --- | --- |
| `tickets_60` | 60 Tickets | Tickets for Workshop unlocks. | US$0.99 |
| `tickets_200` | 200 Tickets | Tickets for Workshop unlocks. | US$2.99 |
| `tickets_500` | 500 Tickets | Tickets for Workshop unlocks. | US$5.99 |

The IDs must match `ticketPacks` in `src/config.ts` exactly. Test a ticket purchase with a license-test account before release, and check the tickets arrive and the same pack can be bought a second time.

**How the game keeps purchases safe.** The game, not the billing plugin, finishes every purchase: it saves the tickets (or Premium) first and only then tells Google the purchase is done. Each purchase token is paid out once. At launch, whenever the player returns to the game, and when the ticket shop opens, it asks Google for paid purchases that were never delivered and delivers them. Payments that are still pending give nothing until they clear, then arrive automatically.

**Test these on a phone with a license-test account** (Play Console offers test cards including "Slow test card, approves after a few minutes" and "Slow test card, declines after a few minutes"):
1. Normal purchase: tickets arrive; buy the same pack again.
2. Slow card that approves: the game says the payment is pending; close the game; reopen after a few minutes; the tickets arrive once.
3. Slow card that declines: no tickets, and the pack can be bought again afterwards.
4. Start a purchase, then force-stop the game from Android settings while the Google Play sheet is open, complete the payment, reopen: the tickets arrive once.

## 6. Testing tracks

1. **Internal testing** (immediate, up to 100 testers): upload the `.aab`, add yourself, install from the opt-in link. This is the first time you can verify, on a real phone:
   - the game launches, sounds play, the status bar and gesture area do not cover the interface;
   - a test rewarded ad plays and grants each of the three rewards; closing it early grants nothing;
   - the Premium purchase completes with a test card, removes the ad wording, and survives "Restore purchase" after reinstalling;
   - progress survives closing and reopening the app.
2. **Closed testing** (required for new personal accounts): at least **12 testers opted in for 14 consecutive days**. Recruit more than 12, since some drop out. Then apply for production access and answer Google's questions about what you learned.
3. **Open testing** (optional): public beta, collects private feedback instead of public reviews.

## 7. Store listing

Text is in `store/listing.md`. Graphics are in `store/`:
- `icon-512.png` (app icon)
- `feature-graphic-1024x500.png`
- `screenshots/*.png` (1080 x 1920; upload at least 4, in numeric order)

A 15 to 30 second gameplay video (YouTube link) is optional but helps a game like this a great deal. Record a full-sky chain on a phone.

## 8. Production release

Production → Create release → upload the `.aab` → paste the release notes → roll out, ideally to 20% first. First reviews can take several days. Watch **Android vitals** (crashes, ANRs) and reply to every early review.

## 9. Shipping an update

1. Make the change, then run tests, build and the end-to-end test.
2. Raise `versionCode` by 1 and set the new `versionName` (see checklist row 8).
3. `npm run android:release`, upload the new `.aab`, write release notes.

Each year Google raises the minimum target API level (announced on the "Target API level requirements" page). When it does: update `android/variables.gradle` (`compileSdkVersion`, `targetSdkVersion`), update Capacitor (`npm install @capacitor/core@latest @capacitor/android@latest @capacitor/cli@latest` and the plugins), then `npx cap sync android` and rebuild.

## 10. Costs

| Cost | Amount | When |
| --- | --- | --- |
| Play developer registration | US$25 | Once |
| Google's service fee | A percentage of Premium sales (15% tier for small developers at the time of writing) | Per sale |
| AdMob | Free | — |
| Hosting the privacy policy | Free (GitHub Pages) | — |
| Servers, analytics, licences | None | — |
| Optional: domain name, Apple programme for iOS, trademark | Varies | Only if you choose to |

Income is taxable; Google collects tax forms in both consoles before paying out.
