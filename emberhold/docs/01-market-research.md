# Project 04 — Market research and concept selection

Research date: 11 November 2026. Decision: **build an idle roguelite defense game — Emberhold.**

## 1. How to read this document

Market figures below come from the cited reports and trade press. Most are secondary write-ups of Sensor Tower, AppMagic and
GameAnalytics data, and several vendor blogs disagree with each other, so treat every number as directional. The concept
scores in section 4 are my judgement applied to that evidence; they are not measured data.

## 2. What the market looks like in late 2026

**The market is flat to shrinking, so picking a growing pocket matters more than picking a big genre.**

- H1 2026: downloads fell 12% to 24bn and IAP revenue fell 2% to about $40bn, while gaming ad spend rose 8% to $7bn [1][2].
- AppMagic put 2025 revenue growth at 0.2%, with the top 200 games "largely unchanged" [3][4]. New entrants are fighting over
  a fixed pie held by incumbents.
- In the US, only five genres grew in H1 2026 while eleven declined [5].

**Where the growth is.**

- Strategy was the only genre to grow revenue, downloads and time spent in 2025 (+16% revenue) [3][6]. It is also the most
  expensive genre to build and to market.
- Puzzle is 44% of casual revenue ($4.9bn in H1 2026). Merge grew 74% to $1.3bn, and hybrid-casual sort/screw/block puzzles
  grew 46% [7][8]. This growth is driven by former hyper-casual publishers with large UA budgets [7].
- Hybrid casual is the one segment with meaningful IAP growth (about +20% YoY) [9]. Hybrid-casual action and strategy titles
  monetise roughly 82% IAP / 18% ads; puzzle hybrids are closer to 50/50 [10].
- Roguelike titles grew 26.2% in 2025 while most sub-genres declined [11]. Mobile RPG revenue has fallen four years running [6].
- Tower defense remains a steady earner and has shifted to hybrid IAP + rewarded-ad monetisation [11][12].

**Retention is the scarce resource.**

- GameAnalytics 2026 medians: D1 about 22%, D7 about 4%, D30 under 1%. Top-decile games reach about 40% D1 and 12% D7 [13][14].
- Casual D14–D30 retention fell 3.5–5.4% in 2025, and AppMagic links flat revenue to falling retention [4].
- Reliable 2026 per-genre retention tables were not available; the grids circulating in 2026 articles are mostly reprints of
  2022 data [15]. I did not use them.

**Cost to acquire players.**

- US average CPI was about $4.90 in Q1 2026, up 34% in two years [16]. Indicative Android CPI: casual $1.50, puzzle $2.00,
  midcore $3.25, hardcore $4.50 [17].
- A solo studio cannot buy its way into Merge, Match-3 or 4X. The concept has to survive on store search, community word of
  mouth and cheap short-video creative.

**Ad revenue anchors.**

- US Android rewarded video eCPM is quoted between $13 and $30 depending on the source; AdMob-only estimates are $8–15 [18][19].
  No published ARPDAU benchmark exists for idle games.

**The indie proof point.**

- *The Tower – Idle Tower Defense* (Tech Tree Games): a reported four full-time staff, 5M+ Google Play installs, and
  third-party revenue estimates of roughly $700–800K per month, with a Sensor Tower weekly US Android peak of $184K in
  Q1 2025 [20][21][22][23]. These are tracker estimates, not audited figures, and the team size has a single source.
- It is a minimalist vector game: one tower, endless waves, in-run upgrades, permanent upgrades, rewarded ads and IAP. It
  shows that this structure earns real money without an art team, without paid-UA scale and on 60–100K downloads a month.
- Comparable titles exist (Idle Hero TD, Idle Monster TD, Towerful Defense) but the niche has one dominant product and no
  crowd of well-funded clones [24]. Idle RPGs on the same store earn far more at the top but need gacha content [25].

**Extra distribution an HTML5 build unlocks.** Web portals share ad revenue with developers (CrazyGames lists 60% of ad
revenue in its 2026 jam terms; Poki negotiates per title) [26]. Emberhold's game layer is HTML5, so a portal build is a
port of the ad layer only.

## 3. What this means for a fourth game

1. Avoid the three biggest pools (Match-3, Merge, 4X). They are where revenue is, and where a solo studio has no chance of
   being seen.
2. Avoid a third puzzle game and a second survival game. The sort/screw/block wave is real but saturated, and it is ad-eCPM
   economics.
3. Choose a structure whose retention comes from systems, because systems are cheap to build and content is not.
4. Choose a genre where rewarded ads are welcomed by players. Idle players opt into "×2 while away" and "×2 run reward"
   at high rates, which monetises non-payers without hurting ratings.
5. Borrow from the two growing mechanics that are cheap to add: roguelite choice (boon drafts) and hybrid monetisation.

## 4. Twenty-two concepts, scored

Scores are 1–10 per criterion (for Competition, 10 means least saturated). Weights sum to 100.

| # | Concept | Revenue (20) | Demand (15) | Feasibility (15) | Retention (12) | Monetization (12) | Competition (10) | Organic (7) | Originality (5) | Expansion (4) | **Score /100** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Idle roguelite defense (single-tower incremental + boon drafts) | 7 | 7 | 9 | 9 | 9 | 6 | 6 | 6 | 9 | **76.4** |
| 2 | Merge-2 orders game | 9 | 9 | 3 | 8 | 9 | 2 | 4 | 3 | 8 | **65.9** |
| 3 | 4X / strategy with base building | 10 | 8 | 1 | 9 | 10 | 2 | 3 | 2 | 9 | **65.0** |
| 4 | Sort / screw / block hybrid puzzle | 7 | 9 | 7 | 6 | 6 | 2 | 6 | 2 | 6 | **62.0** |
| 5 | Idle RPG (stage-push, gear gacha) | 8 | 7 | 3 | 8 | 9 | 3 | 4 | 3 | 8 | **61.9** |
| 6 | Match-3 with meta | 9 | 9 | 2 | 8 | 9 | 1 | 2 | 1 | 7 | **60.6** |
| 7 | Survivor-like (auto-shooter roguelite) | 7 | 7 | 5 | 7 | 7 | 3 | 6 | 3 | 7 | **60.3** |
| 8 | Idle tycoon / business simulator | 6 | 6 | 6 | 7 | 7 | 3 | 4 | 3 | 7 | **56.9** |
| 9 | Cozy farming / life sim | 6 | 7 | 2 | 8 | 7 | 4 | 6 | 4 | 8 | **56.9** |
| 10 | Solitaire / card classic | 6 | 7 | 8 | 8 | 6 | 2 | 2 | 1 | 4 | **56.8** |
| 11 | Auto-battler / merge-battle PvE | 6 | 6 | 4 | 7 | 7 | 4 | 5 | 4 | 7 | **56.1** |
| 12 | Arrow-escape tap puzzle | 5 | 8 | 9 | 5 | 4 | 3 | 6 | 2 | 4 | **56.1** |
| 13 | Word puzzle (daily) | 5 | 6 | 8 | 7 | 5 | 3 | 5 | 3 | 5 | **55.4** |
| 14 | Idle clicker (pure incremental) | 4 | 5 | 9 | 7 | 5 | 4 | 4 | 3 | 6 | **54.1** |
| 15 | Classic lane tower defense | 5 | 6 | 6 | 6 | 6 | 4 | 4 | 3 | 6 | **53.1** |
| 16 | Deckbuilder roguelike (premium) | 5 | 5 | 4 | 7 | 4 | 5 | 6 | 6 | 6 | **51.3** |
| 17 | Trivia / quiz | 4 | 5 | 8 | 5 | 4 | 4 | 5 | 3 | 5 | **49.3** |
| 18 | Physics sandbox / ragdoll toy | 4 | 6 | 6 | 4 | 3 | 5 | 8 | 5 | 4 | **49.1** |
| 19 | Narrative choices / interactive story | 5 | 5 | 3 | 6 | 7 | 4 | 4 | 4 | 6 | **48.8** |
| 20 | Coloring / ASMR relax app | 4 | 6 | 7 | 5 | 5 | 3 | 5 | 2 | 4 | **48.6** |
| 21 | Casual PvP .io arena | 5 | 6 | 3 | 5 | 5 | 4 | 6 | 3 | 6 | **47.6** |
| 22 | Hyper-casual arcade runner | 3 | 6 | 9 | 2 | 3 | 2 | 5 | 2 | 2 | **41.8** |

### One-line rationale for each

- **Idle roguelite defense (single-tower incremental + boon drafts)** (76.4): Proven by a 4-person studio earning an estimated $700-800K/month from one title; rewarded-ad + IAP fit; vector art is cheap.
- **Merge-2 orders game** (65.9): Fastest-growing big genre (+74% YoY) but dominated by funded studios with heavy content and UA budgets.
- **4X / strategy with base building** (65.0): The only genre growing on every metric, and the least feasible for an indie.
- **Sort / screw / block hybrid puzzle** (62.0): +46% revenue, but extremely crowded and the founder already owns two puzzle games.
- **Idle RPG (stage-push, gear gacha)** (61.9): High revenue ceiling, but needs gacha content, art volume and live-ops beyond a solo scope.
- **Match-3 with meta** (60.6): Largest casual revenue pool and the most saturated.
- **Survivor-like (auto-shooter roguelite)** (60.3): Roguelikes grew 26% but the niche is led by large publishers; overlaps the founder's survival game.
- **Idle tycoon / business simulator** (56.9): Mature, publisher-dominated; needs many themed art sets.
- **Cozy farming / life sim** (56.9): Strong demand; far too content-heavy.
- **Solitaire / card classic** (56.8): Large older audience, dominated by entrenched apps with huge UA.
- **Auto-battler / merge-battle PvE** (56.1): Good monetisation; balance and unit art are heavy.
- **Arrow-escape tap puzzle** (56.1): Topped downloads in 2026; ad-only economics, clone-saturated, weak IAP.
- **Word puzzle (daily)** (55.4): Sticky, but ad-eCPM driven and crowded; third puzzle for the founder.
- **Idle clicker (pure incremental)** (54.1): Cheap to build, but low ARPDAU without a combat or drama layer.
- **Classic lane tower defense** (53.1): Steady earner; level design content is expensive per hour of play.
- **Deckbuilder roguelike (premium)** (51.3): One-time purchase model caps revenue; hits are rare outliers.
- **Trivia / quiz** (49.3): Content upkeep, modest ARPDAU.
- **Physics sandbox / ragdoll toy** (49.1): Very viral on short video, weak monetisation.
- **Narrative choices / interactive story** (48.8): Writing volume is the cost; dominated by a few networks.
- **Coloring / ASMR relax app** (48.6): Ad and subscription driven, crowded, content pipeline needed.
- **Casual PvP .io arena** (47.6): Needs netcode or convincing bots, plus servers.
- **Hyper-casual arcade runner** (41.8): Retention too low to monetise without paid UA at scale.

## 5. The winner: Emberhold — idle roguelite defense

**Loop.** A lone campfire auto-fires sparks at shades walking in from the dark. Kills pay Cinders, spent in-run on 13
upgrades. Every five waves the player drafts one of three boons. The fire eventually dies; the run pays Embers, spent in the
Workshop on permanent levels, new upgrade unlocks, flames (characters) and abilities. Harder difficulties multiply Embers.

**Why it beats the alternatives commercially.**

- *Against Merge / Match-3 / 4X (higher revenue ceilings):* those need content pipelines and seven-figure UA. Their expected
  revenue for a solo developer is close to zero. Emberhold's ceiling is lower and its floor is far higher.
- *Against sort/screw/arrow puzzles (higher demand):* those live on interstitial ads at falling retention, with dozens of
  clones per month. Emberhold has IAP depth and a single dominant competitor.
- *Against survivor-likes:* same roguelite appeal, but survivor-likes need many enemy and weapon art sets and sit close to
  the founder's existing survival game.
- *Against a pure clicker:* the combat layer creates loss, tension and "one more run", which is where rewarded-ad revive
  and double-reward placements earn.

**Target audience.** Incremental/idle players, 18–44, skewing male, who play in short check-ins plus long background
sessions; the r/incremental_games and idle-TD communities; players of The Tower looking for something with more decisions.

**Distinct identity.** The genre's leader is abstract neon geometry. Emberhold is a campfire in the dark: light radius is
range, enemies are silhouettes with glowing eyes, the camera pulls back as the light grows. The fantasy is readable in a
three-second clip, which matters for store screenshots and short video.

**Differentiation in play.** Boon drafts every five waves add roguelite decisions the leader lacks; flames act as
characters with different rules; the game never shows an unrequested ad.

**Risks.**

- One dominant competitor has years of content. Mitigation: a different theme and a decision layer, not a clone.
- Idle games earn slowly; revenue needs D30+ retention. Mitigation: six difficulties, daily quests, streaks, achievements,
  offline income, and a long Workshop curve (simulated: difficulty 2 at ~2 h, difficulty 3 at ~8 h of run time).
- No paid UA budget. Mitigation: store keywords ("idle tower defense", "incremental"), community posts, web-portal build.
- Revenue estimates for the reference title are third-party. The plan should be judged on Emberhold's own soft-launch data.

## 6. Sources

1. PocketGamer.biz — Mobile gaming IAP dipped 2% as ad spend climbed in H1 2026: https://www.pocketgamer.biz/mobile-gaming-iap-dipped-2-as-ad-spend-climbed-in-h1-2026/
2. Outlook Respawn — Mobile gaming IAP revenue drops 2% as ad spend surges in 2026: https://respawn.outlookindia.com/gaming/gaming-news/mobile-gaming-iap-revenue-drops-2-as-ad-spend-surges-in-2026
3. PocketGamer.biz — Games revenue growth stalls in 2025 as strategy emerges as the fastest-growing genre: https://www.pocketgamer.biz/games-revenue-growth-stalls-in-2025-as-strategy-emerges-as-the-fastest-growing-genre
4. GameDev Reports — AppMagic: Mobile Market Landscape in 2026: https://gamedevreports.substack.com/p/appmagic-mobile-market-landscape
5. PocketGamer.biz — H1 2026 genre analysis: https://www.pocketgamer.biz/h1-2026-genre-analysis-strategy-stumbles-rpgs-fall-and-puzzle-revenue-ramps-up/
6. GameDev Reports — Sensor Tower: State of Gaming 2026: https://gamedevreports.substack.com/p/sensor-tower-state-of-gaming-2026
7. AppMagic — Casual Games Report H1 2026: https://appmagic.rocks/research/casual-report-H12026
8. PocketGamer.biz — Puzzle accounts for 44% of casual mobile earnings in H1 2026: https://www.pocketgamer.biz/puzzle-accounts-for-44-of-casual-mobile-earnings-in-h1-2026/
9. Global Games Forum — State of Gaming 2026 mobile data breakdown: https://www.globalgamesforum.com/news/state-of-gaming-heres-what-the-mobile-data-actually-says
10. Cinevva — Casual games trends in 2026: https://app.cinevva.com/guides/casual-games-trends-2026
11. GameDev Reports — AppMagic: Mobile Games Monetization Report 2025: https://gamedevreports.substack.com/p/appmagic-mobile-games-monetization
12. Sensor Tower — Q4 2025 top tower defense games by revenue (US, iOS): https://sensortower.com/blog/2025-q4-ios-top-5-tower-defense-games-revenue-us-6012932d241bc16eb85e0db8
13. InvestGame — Mobile retention benchmarks 2026 (GameAnalytics): https://investgame.net/wp-content/uploads/2026/01/2026-01-20-Mobile_retention_benchmarks_2026.pdf
14. AppFollow — Mobile game retention in 2026: https://appfollow.io/blog/mobile-game-retention
15. Game Growth Advisor — Mobile game KPI benchmarks 2026: https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/
16. FoxData — Mobile game UA in 2026: why CPI is rising: https://foxdata.com/en/blogs/mobile-game-ua-in-2026-why-cpi-is-rising-and-what-smart-studios-do-differently/
17. Mistplay — User acquisition cost by genre: https://business.mistplay.com/resources/user-acquisition-cost
18. Playio — Mobile game eCPM benchmarks 2026: https://blog.playio.co/mobile-game-ecpm-benchmarks-2026
19. MAF — Rewarded ads performance insights for 2026: https://maf.ad/en/blog/rewarded-ads-stats/
20. Adapty — The Tower paywall and revenue estimate: https://adapty.io/paywall-library/the-tower/
21. Sensor Tower — Q1 2025 top idler games by revenue (US, Android): https://sensortower.com/blog/2025-q1-android-top-5-idler%20games-revenue-us-602ae7fb241bc16eb874f8e1
22. AppBrain — Tech Tree Games developer page: https://www.appbrain.com/dev/Tech+Tree+Games/
23. Baijing — article on Tech Tree Games' team size: https://www.baijing.cn/article/54549
24. GameBrain — games like Idle Tower Defense: https://gamebrain.co/games-like/idletowerdefense
25. Sensor Tower — Q4 2025 top idle RPGs by revenue (US): https://sensortower.com/blog/2025-q4-unified-top-5-idle-rpg-revenue-us-6040bbc2241bc16eb883a0cb
26. Cinevva — CrazyGames developer guide 2026: https://app.cinevva.com/guides/publish-game-crazygames
27. PocketGamer.biz — Over 95,000 mobile games were downloaded every minute in 2025: https://www.pocketgamer.biz/over-95000-mobile-games-were-downloaded-every-minute-in-2025
