# Fuseworks — Development Blueprint

Research date: November 2026. Figures come from the secondary sources listed at the end; several are vendor blogs that disagree with each other, so treat every number as directional and check the primary report before relying on it.

## 1. Market intelligence

| Finding | Evidence | What it means for a small-budget game |
| --- | --- | --- |
| Downloads are falling, revenue is flat | H1 2026 installs reported down about 12% year on year; revenue roughly flat to slightly down. Sensor Tower's CEO describes mobile as mature: the opportunity is "innovations in retention and monetization", not acquiring new users. | Buying installs is not an option. The game must earn organic attention and keep the players it gets. |
| Hybrid-casual is the segment that is growing | Hybrid-casual revenue reported up 20% to 37% depending on the analyst, with hybrid-casual puzzle the standout. Puzzle was about 44% of casual spending in H1 2026. | Simple core action plus a deep meta layer is the right shape. |
| The big puzzle sub-genres are saturated | One analysis found only 1 of 120 new match-3 games reached US$100k in a month in H1 2026. Merge is dominated by a few large titles. | Do not make match-3, merge, or a block-sort clone. |
| "Score-builder" roguelikes proved depth sells on phones | Balatro, made by one developer, topped paid charts on both stores, won Best Mobile Game at The Game Awards 2024 and reportedly grossed millions on mobile as a one-time purchase. Roundups describe a wave of games chasing the formula. | There is proven appetite for run-based, rule-bending scoring games. The space is contested on cards, dice and words, but not on spatial chain reactions. |
| Players are tired of forced ads, but accept chosen ones | Only 31% of surveyed US mobile gamers called ad load acceptable; several surveys report most players have quit a game over disruptive ads. About 45% say they do not mind ads that give a reward. | "No forced ads, ever" is both the right thing to build and a store selling point. Monetise with opt-in rewards and a one-time unlock. |
| Short-form video is the main free discovery channel, with caveats | Guides agree TikTok, Reels and Shorts are the main free reach for indies; some report organic reach declining, and a solo-developer thread argues store search optimisation returns more per hour. | The game needs a payoff that reads in three seconds of silent vertical video, and a store listing built for search. |
| Publishing has real gates | New personal Play accounts must run a closed test with 12 testers for 14 days before production. New apps must target Android 16 (API 36). | Plan the tester recruitment and build to the current API level from day one. |

**Unmet demand this points to:** a free, offline-friendly, respectful puzzle roguelike with a spectacular visual payoff, on a phone, with no forced ads.

## 2. Fifteen concepts, scored

Scores are 1 to 10. Weights: market opportunity 15%, player demand 15%, and 10% each for originality, replayability, ease of development, visual appeal, monetisation fit, marketing potential and suitability for AI-driven development.

| Rank | Concept | One line | Mkt | Dem | Orig | Replay | Ease | Visual | Monet | Mktg | AI | **Total** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Fuseworks** | Build a firework display on a grid, light one fuse, chain-react; roguelite charms | 8 | 8 | 8 | 9 | 7 | 9 | 7 | 10 | 9 | **8.3** |
| 2 | Lasso Tide | Draw a loop around drifting sea creatures to net scoring "hands" | 8 | 7 | 9 | 8 | 6 | 8 | 7 | 9 | 6 | **7.6** |
| 3 | Hex Apiary | Cozy hex tile-laying honey garden with rule-bending queens | 8 | 8 | 6 | 8 | 7 | 8 | 7 | 6 | 8 | **7.4** |
| 4 | Dice Bakery | Draft dice into recipes; score-builder | 7 | 7 | 5 | 8 | 8 | 6 | 7 | 6 | 9 | 7.0 |
| 5 | Wordforge | Word-building roguelite with letter relics | 7 | 7 | 5 | 8 | 8 | 5 | 7 | 6 | 9 | 6.9 |
| 6 | Pocket Orbit | Gravity-slingshot golf around planets, daily course | 6 | 6 | 7 | 7 | 6 | 8 | 6 | 8 | 6 | 6.6 |
| 7 | Snakelite | Snake with roguelite upgrades | 6 | 6 | 6 | 8 | 7 | 6 | 6 | 7 | 8 | 6.6 |
| 8 | Stack Café | Physics pastry stacking | 6 | 6 | 5 | 6 | 7 | 8 | 6 | 8 | 6 | 6.4 |
| 9 | Gloomkeeper | Lantern tower-defence roguelite | 7 | 7 | 6 | 8 | 4 | 7 | 7 | 6 | 5 | 6.4 |
| 10 | Mergequarium | Idle merge aquarium | 8 | 7 | 3 | 6 | 5 | 8 | 8 | 5 | 5 | 6.3 |
| 11 | Sandscribe | Falling-sand colour puzzle | 7 | 6 | 5 | 6 | 5 | 8 | 6 | 8 | 5 | 6.3 |
| 12 | Tiny Tracks | Draw rail lines to route coloured trains | 6 | 7 | 5 | 7 | 5 | 7 | 6 | 6 | 6 | 6.2 |
| 13 | Rhythm Loom | One-thumb rhythm weaving | 6 | 6 | 7 | 7 | 4 | 8 | 6 | 8 | 4 | 6.2 |
| 14 | Beamline | Mirror and light-beam puzzle with authored levels | 6 | 6 | 5 | 5 | 6 | 7 | 5 | 5 | 7 | 5.8 |
| 15 | Echo Run | One-tap reflex runner with a daily seed | 5 | 5 | 3 | 5 | 9 | 6 | 5 | 6 | 9 | 5.8 |

### Top three
- **Fuseworks (8.3).** Best all-round. Detailed below.
- **Lasso Tide (7.6).** The most original input, but it is real-time and dexterity-based, which is hard to balance and hard for an AI to test, and the creatures need real illustration.
- **Hex Apiary (7.4).** Safe and pleasant, rides the hex and cozy trends, but it is the closest to existing tile-layers and the weakest on video.

### Why Fuseworks wins
It was not chosen for being the easiest (Echo Run and Dice Bakery are easier). It wins on the combination:
1. **Marketing is built into the mechanic.** Every round ends with one tap setting off the whole screen. That is the clip.
2. **Zero art budget.** Glowing particles on a night sky look premium and are generated entirely by code. The audio is synthesised too. Nothing to buy, nothing to license.
3. **Open lane.** Searches found firework sandboxes and a PC firework deckbuilder, but no mobile grid chain-reaction score-builder.
4. **Testable by an AI.** Turn-based and deterministic, so a bot can play thousands of runs to balance it and an automated test can play the real build.
5. **A calendar of free marketing hooks.** New Year's Eve, Lunar New Year, the Fourth of July, Diwali, Bonfire Night.

Main risks: a spatial puzzle is harder to grasp than "match three" (addressed with a scripted tutorial, a chain preview and a very easy first night), and web rendering on low-end phones (addressed with a particle budget and automatic quality reduction; unverified on real low-end hardware).

## 3. Game design summary

The full specification, with every table and number, is in `MASTER_PROMPT.md` section 3. In brief:

- **Core loop:** place shells from a hand of 5 onto a 5 x 6 sky; tap a shell to preview the chain; light it. Applause = Sparkle x Awe. The display stays and re-fires with each of 3 Matches, growing each time.
- **Run:** 6 nights of 3 shows with rising targets; Finales add weather. One Encore per run after a failure.
- **Build:** 28 charms, 14 shell types, refinements, crate trimming, bought with coins at the Market between shows.
- **Meta:** tickets unlock shells, charms, crates and skies; 5 stakes; 15 achievements; Daily Show with medals and a streak.
- **Modes:** Festival, Endless (its own button on the title, or carried on after a festival win), Daily Show, scripted tutorial.

## 4. Commercial strategy

No revenue is projected here and profitability is not promised. Most mobile games, including good ones, earn little; treat the launch as a low-cost experiment with clear signals for whether to invest more.

### Pricing
- Free download.
- Premium: one-time **US$3.99**, using Play's automatic regional pricing. Consider testing US$2.99 and US$4.99 later; do not discount in the first month.
- Ticket packs (consumable): 60 for US$0.99, 200 for US$2.99, 500 for US$5.99. Tickets only speed up permanent unlocks that every player earns by playing; they never buy power within a run or random rewards. No subscriptions.

### Revenue opportunities, in order of effort
1. Rewarded ads (three opt-in placements) and Premium, both already built.
2. A browser version on HTML5 portals (itch.io for free; CrazyGames and Poki by application). The game is already web technology, so this is mostly paperwork, and it doubles as a free demo that points to the Play listing.
3. Cosmetic sky packs as small one-time purchases, once there is an audience asking for more.
4. iOS: Capacitor can target iOS from the same code, but it needs a Mac and Apple's US$99 per year programme. Do it only if Android shows traction.
5. A paid desktop release (Steam) with more content, if the game finds a core audience.

### Store positioning
- **Title:** `Fuseworks: Firework Roguelike` (29 characters).
- **Promise:** "Build a firework display. Light one fuse. Watch the whole sky go."
- **Differentiator in the first line of the description and in screenshot 1:** no forced ads, plays offline.
- **Category:** Puzzle. Tags: roguelike, puzzle, strategy.
- **Search terms to work into the description naturally:** fireworks game, chain reaction, roguelike puzzle, deckbuilder, score attack, offline game, no ads.
- Ask for a rating only after a player wins a show, never on launch.

### Organic marketing
- **Short-form video, 3 to 5 clips a week, vertical, sound on:** a full-sky chain with the score climbing ("one fuse, 31 fireworks"); "can I beat 100,000 with only blue shells"; a charm that breaks the game; the developer story ("an AI and I built a firework roguelike"). First second must show the tap and the first burst. Post the same clip to TikTok, Reels and Shorts.
- **Communities, following each one's self-promotion rules:** r/AndroidGaming, r/roguelites, puzzle-game communities, roguelike Discords, itch.io. Lead with the browser demo, not a store link.
- **The Daily Show share text** is a built-in word-of-mouth loop; encourage it.
- **Press:** short personal emails with a 20-second clip and a build to Pocket Gamer, Pocket Tactics, Android Police's game roundups, and YouTubers who cover score-builder roguelikes.
- **Seasonal beats:** time updates and posts to firework holidays. Launching before New Year's Eve is realistic if closed testing starts promptly.

### First players
1. Friends, family and community volunteers for the required 12-tester closed test. Use it as a real test: watch two people play without helping them.
2. Open testing on Play plus the browser demo to collect early reviews and bug reports.
3. Production launch, with the first week's clips prepared in advance.

### Signals worth watching (Play Console gives these free)
Store-listing conversion, day-1 and day-7 retention, share of players reaching night 2, crash-free rate, ratings text. If day-1 retention is weak, fix onboarding before spending any effort on marketing.

### Future updates
- 1.1: more shells and charms, a seasonal sky, challenge runs with fixed rules.
- 1.2: online Daily Show leaderboard and cloud save through Google Play Games Services (free), localisation of the interface.
- 1.3: weekly events, new crates, an unlockable "architect" sandbox.

## 5. What the project needs from outside

| Item | Needed for | Cost |
| --- | --- | --- |
| Google Play developer account | Publishing | US$25 one-time (confirm on Google's sign-up page). Identity verification required. |
| Google AdMob account | Real rewarded ads | Free. Pays out above a threshold. |
| Play in-app product `premium_unlock` | Premium purchase | Free to create. Google keeps a service fee on sales (15% on the first US$1M per year under its small-developer tier; confirm current terms). |
| A public web page for the privacy policy | Required by Play and AdMob | Free with GitHub Pages or similar. |
| 12 testers with Android phones for 14 days | New personal accounts only | Free, but takes organising. |
| An Android phone for testing | Verifying the real build | You probably own one. |
| Fonts, art, music, sound | — | None needed: all generated by code. |
| Servers, analytics, databases | — | None used. |
| Optional: Apple Developer Program + a Mac | iOS port | US$99 per year. |
| Optional: trademark search / registration for the name | Protecting "Fuseworks" | Varies by country. A quick web search found no game with this name, which is not legal clearance. |

**Ongoing fixed cost to keep the game live: none.**

## 6. What still needs a human

- Create and verify the Play Console and AdMob accounts, and accept their agreements.
- Decide the final application ID before the first upload (it can never change afterwards).
- Paste the real AdMob IDs into two files and create the in-app product.
- Host the privacy policy and put its URL in the app and the listing.
- Recruit the testers, upload the build, fill in the store forms (prepared answers are in `PUBLISHING.md`).
- Play the game on real phones, especially an older or cheaper one. This has not been done.
- Keep the signing keystore and its passwords somewhere safe.
- Make and post the marketing clips, and answer reviews.
- Tax and payout details in Google's consoles.

## Sources
- [State of Mobile 2026: 9 trends](https://www.deconstructoroffun.com/blog/2026/2/2/state-of-mobile-2026)
- [Casual games trends in 2026](https://app.cinevva.com/guides/casual-games-trends-2026)
- [Mobile game revenue H1 2026](https://tech-insider.org/mobile-game-revenue-decline-2026/)
- [Sensor Tower: mobile game ad monetization in 2026](https://gamedevreports.substack.com/p/sensor-tower-mobile-game-ad-monetization)
- [Puzzle accounts for 44% of casual mobile earnings in H1 2026](https://www.pocketgamer.biz/puzzle-accounts-for-44-of-casual-mobile-earnings-in-h1-2026/)
- [H1 2026 genre analysis](https://www.pocketgamer.biz/h1-2026-genre-analysis-strategy-stumbles-rpgs-fall-and-puzzle-revenue-ramps-up/)
- [Mobile mavens on rising barriers to entry](https://www.pocketgamer.biz/mobile-has-become-too-expensive-for-the-old-playbook-the-mobile-mavens-on-rising-barriers-to-entry/)
- [Balatro tops mobile charts](https://gamesradar.com/games/roguelike/balatro-creator-in-disbelief-as-the-roguelike-hit-tops-mobile-sales-charts-beating-minecraft-and-stardew-valley-despite-one-pesky-issue), [Balatro five million sales](https://www.pocketgamer.com/balatro/five-million-sales), [mobile games like Balatro](https://choostgames.com/blog/mobile-games-like-balatro/)
- [Only 31% of mobile gamers think ad frequency is acceptable](https://blog.tapresearch.com/survey-insights-only-31-of-mobile-gamers-think-ad-frequency-is-acceptable)
- [Poor in-game ads can push 1 in 5 mobile gamers to quit](https://www.emarketer.com/content/poor-in-game-ads-push-1-5-mobile-gamers-quit-threaten-brand-loyalty)
- [Ad quality challenges for mobile gaming](https://www.globalgamesforum.com/news/ad-quality-challenges-and-solutions-for-mobile-gaming-in-2025)
- [Rewarded ad benchmarks 2026](https://blog.playio.co/rewarded-ad-benchmarks-2026)
- [TikTok indie game marketing field guide](https://presskit.gg/field-guides/tiktok-indie-game-marketing), [How to market an indie game on TikTok, Reels and Shorts](https://findclout.com/blog/how-to-market-an-indie-game-on-tiktok), [Indie developer market analysis](https://fungies.io/indie-developer-market-analysis)
- [Google Play target API requirements](https://developer.android.com/google/play/requirements/target-sdk)
- [Google Play closed testing requirements 2026](https://www.testerscommunity.com/blog/google-play-closed-testing-requirements-2026)
- [Starfire Skies (PC firework deckbuilder)](https://store.steampowered.com/app/2544040/Starfire_Skies)
