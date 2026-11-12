# Market research — Project 05

Researched 11–12 Nov 2026 by web search. **Honesty note:** I could not open paid databases (Sensor Tower, AppMagic). Every figure below is quoted from public write-ups of those reports, linked in Sources; where two write-ups disagree I say so. The 1–5 concept scores are my judgment, not measured data. No revenue forecast is made for Brewfall, because any number would be invented.

## What the market looks like

- **Flat revenue, falling downloads.** Sensor Tower's State of Gaming 2026 is reported as mobile game IAP revenue about +1% to roughly $82B in 2025 with installs down about 7%. Its H1 2026 index is reported as IAP −2% to about $40B, downloads −12% to 24B, and gaming ad spend +8% to about $7B. Fewer installs and more ad spend means paid user acquisition is getting more expensive; a new indie game cannot plan on buying its audience.
- **Hybrid-casual is the growth engine.** Mid-core is still the biggest model but losing share; casual is flat; hybrid-casual is described as the clear growth segment (about +20% IAP in 2025 in one write-up). Top hybrid-casual titles are reported to have overtaken casual on day-7 retention.
- **Merge is the fastest-growing big subgenre.** AppMagic's H1 2026 casual report is quoted as merge at about $1.2–1.3B for the half, up roughly 74% year on year (one source says "nearly doubled"; treat the exact number as approximate), downloads +20–24%. Sort/screw/block hybrid puzzles grew about 46%. Puzzle is about 44% of casual IAP.
- **But merge-2 is a spending war.** Most top merge grossers are from large Chinese publishers plus Moon Active; analysts expect heavy UA spend to continue. The classic merge-2 board game also needs hundreds of illustrated items and constant live content.
- **Strategy/4X** was the only genre growing on revenue, downloads and time spent in 2025, but it needs servers, live operations and big UA budgets.
- **Roguelike score-builders are where solo developers actually win.** Balatro was made by one developer; public figures for its mobile revenue range from $4.4M after two months to above $20M later (sources use different dates and definitions). Dice of Kalma, a Balatro-like, passed 1M downloads across platforms. CloverPit sold 1M+ on Steam in about ten weeks and launched on mobile at $4.99. These games spread by word of mouth and streaming, not paid ads.
- **Those hits are premium on mobile.** Balatro, CloverPit and Pokermancer are paid or pay-to-unlock. I found no evidence of a dominant *free-to-play* score-builder on Google Play. That is the gap.
- **Retention reality check.** GameAnalytics' 2026 benchmarks are reported as median D1 about 22% and D7 about 4%, top-decile D1 about 40% and D7 about 12%. Depth and daily reasons to return matter more than launch polish.
- **Ad economics.** Public 2026 estimates for US Android rewarded video eCPM span about $13–$30 depending on source; hybrid-casual blended ARPDAU is quoted at $0.15–$0.50 (vendor estimates, not audited).
- **Platform rules.** New apps and updates must target Android 16 (API 36) since 31 Aug 2026. Brewfall targets API 36.

## Opportunity for a small studio

The intersection that fits one developer with no UA budget: a mechanic with proven mass appeal (drop-and-merge), given the build-crafting depth that makes roguelike score-builders retain and spread organically, shipped free-to-play on Android where the genre leaders are paid. Art needs are tiny (ten essences, icons), there is no level-content treadmill (runs are generated), and no server is required.

## 22 concepts, weighted scoring

Weights (sum 100): development feasibility 18, revenue opportunity 15, market demand 12, retention 12, monetisation 12, competition 10 (5 = least crowded), organic discovery 10, expansion 6, originality 5. Feasibility and commercial factors carry 79% of the weight on purpose.

| # | Concept | Rev | Demand | Comp | Feas | Ret | Mon | Organic | Orig | Expand | **Score /100** | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Drop-merge roguelike score-builder (Brewfall) | 4 | 4 | 3 | 5 | 4 | 4 | 4 | 4 | 4 | **81.6** | Merge demand + Balatro-style depth; tiny art need; F2P gap on Android |
| 2 | Poker-hand roguelike (Balatro-like) | 4 | 4 | 2 | 5 | 4 | 3 | 3 | 1 | 3 | **71.0** | Proven, but crowded with clones and a premium incumbent |
| 3 | Dice roguelike score-builder | 3 | 3 | 3 | 5 | 4 | 3 | 3 | 2 | 3 | **68.6** | Dice of Kalma shows demand; already served |
| 4 | Survivor-like action roguelite | 4 | 4 | 2 | 3 | 4 | 4 | 3 | 1 | 4 | **67.4** | Repeats the survival game; CPI reportedly tripled |
| 5 | Slot-machine roguelike | 3 | 3 | 3 | 4 | 4 | 3 | 4 | 2 | 3 | **67.0** | CloverPit hit; simulated-gambling rating and ad-policy risk |
| 6 | Sort puzzle (colour/goods sort) | 4 | 5 | 1 | 4 | 3 | 4 | 2 | 1 | 3 | **65.8** | Growing, but a third puzzle game and a UA-driven red ocean |
| 7 | Pachinko / peg roguelike | 3 | 3 | 3 | 4 | 3 | 3 | 4 | 3 | 3 | **65.6** | Watchable; less player agency, harder to balance |
| 8 | Merge-2 board with story/renovation | 5 | 5 | 1 | 1 | 4 | 5 | 2 | 1 | 4 | **64.0** | Fastest-growing genre, but content and UA scale are out of indie reach |
| 9 | Word roguelike | 3 | 3 | 3 | 4 | 3 | 3 | 3 | 3 | 3 | **63.6** | English-only limits reach; localisation cost |
| 10 | Idle tycoon / shop simulator | 3 | 4 | 2 | 3 | 4 | 4 | 2 | 2 | 4 | **63.4** | Simulation grew in H1 2026; overlaps existing idle game |
| 11 | 4X-lite strategy | 5 | 4 | 1 | 1 | 5 | 5 | 1 | 1 | 5 | **63.2** | Only genre growing on all metrics in 2025; needs servers and live ops |
| 12 | Solitaire / card patience with meta | 4 | 4 | 1 | 4 | 4 | 4 | 1 | 1 | 2 | **62.6** | Evergreen but owned by incumbents |
| 13 | Auto-battler / backpack inventory battler | 4 | 3 | 2 | 2 | 4 | 4 | 3 | 2 | 4 | **62.4** | Needs many units, PvP balance and ideally servers |
| 14 | Block puzzle with meta | 4 | 5 | 1 | 4 | 3 | 3 | 2 | 1 | 2 | **62.2** | Dominated by giants; repeats the portfolio |
| 15 | Cozy pet/creature collector | 3 | 4 | 2 | 2 | 4 | 4 | 3 | 2 | 4 | **61.8** | Art-heavy |
| 16 | Match-3 with decoration meta | 5 | 5 | 1 | 1 | 4 | 5 | 1 | 1 | 3 | **60.8** | Largest casual revenue, impossible budget |
| 17 | Screw/bolt pin puzzle | 4 | 4 | 1 | 3 | 3 | 4 | 2 | 1 | 3 | **59.8** | Same problem as sort; level-content treadmill |
| 18 | Fishing / collection idle | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 2 | 3 | **57.0** | Too close to existing idle title |
| 19 | Physics merge only (Suika clone) | 2 | 4 | 1 | 5 | 2 | 2 | 3 | 1 | 2 | **54.6** | Flooded with clones; no depth to retain or monetise |
| 20 | Endless runner / one-tap arcade | 2 | 3 | 2 | 5 | 2 | 2 | 3 | 1 | 2 | **54.2** | Hypercasual economics; ads-only, weak retention |
| 21 | Arcade idle (stack and upgrade 3D) | 3 | 3 | 2 | 2 | 3 | 3 | 3 | 2 | 3 | **53.4** | Needs 3D content pipeline |
| 22 | Tower-climb rhythm / timing arcade | 2 | 2 | 3 | 4 | 2 | 2 | 3 | 3 | 2 | **52.2** | Small proven demand |

## Decision

**Winner: #1, a drop-merge roguelike score-builder, shipped as "Brewfall".** It is not the biggest market (match-3, merge-2 and 4X are) but it is the best opportunity: the only concept that scores 4+ on demand, retention, monetisation and organic reach while also being fully buildable and operable by one developer with zero infrastructure cost.

Portfolio check: you already have two puzzle games, a survival game and an idle defense game. Brewfall has a physics-merge surface but plays as a roguelike build-crafter (runs, shops, relic synergies, rivals), which none of the four are.

**Main risks:** (1) the idea is not unoccupied: Dogpile is on mobile, Fruitbearer on PC, and more are announced, so speed and a free price point matter; (2) "roguelike deckbuilder fatigue" is mentioned in press coverage; (3) with no UA budget, growth depends on store listing quality and shareable clips; (4) all balance so far is from bot simulation, not human playtests.

## Sources

- Sensor Tower State of Gaming 2026 (summary): https://gamedevreports.substack.com/p/sensor-tower-state-of-gaming-2026
- Sensor Tower press release: https://sensortower.com/press/press-release-sensor-tower-state-of-gaming-gaming-drove-52-billion-downloads-82b-iap-revenue-on-mobile-and-12b-premium-revenue-on-steam
- H1 2026 IAP/ad spend: https://www.pocketgamer.biz/mobile-gaming-iap-dipped-2-as-ad-spend-climbed-in-h1-2026/
- Global Games Forum breakdown: https://www.globalgamesforum.com/news/state-of-gaming-heres-what-the-mobile-data-actually-says
- AppMagic Casual Games Report H1 2026: https://appmagic.rocks/research/casual-report-H12026
- Puzzle share of casual, H1 2026: https://www.pocketgamer.biz/puzzle-accounts-for-44-of-casual-mobile-earnings-in-h1-2026/
- Sort/block/screw trend: https://mobidictum.com/sort-block-screw-mechanics-puzzle-games-market/
- H1 2026 genre analysis: https://www.pocketgamer.biz/h1-2026-genre-analysis-strategy-stumbles-rpgs-fall-and-puzzle-revenue-ramps-up/
- Top puzzle grossers 2026: https://respawn.outlookindia.com/gaming/gaming-news/top-mobile-puzzle-games-ruling-the-global-grossing-charts-in-2026
- Deconstructor of Fun, State of Mobile 2026: https://www.deconstructoroffun.com/blog/2026/2/2/state-of-mobile-2026
- GameAnalytics 2026 benchmarks (summary): https://gamedevreports.substack.com/p/gameanalytics-mobile-and-pc-game
- Balatro mobile revenue: https://www.pocketgamer.biz/balatro-nears-44m-on-mobile-amid-a-sudden-spending-surge and https://www.pockettactics.com/premium-mobile-games-increase
- Dice of Kalma 1M downloads: https://www.pocketgamer.com/dice-of-kalma/one-million-downloads/
- CloverPit: https://www.pcgamer.com/games/roguelike/slot-machine-roguelike-cloverpit-sells-1-million-copies-and-its-developer-celebrates-the-payout-by-adding-its-most-requested-feature-yet and https://www.gematsu.com/2025/12/cloverpit-coming-to-ios-android-on-december-17
- Dogpile on mobile: https://www.pocketgamer.com/dogpile/official-launch-android-ios/
- Fruitbearer: https://ingamenews.com/gaming-news/fruitbearer-blends-physics-puzzles-with-roguelike-deckbuilding/
- eCPM / ARPDAU estimates: https://blog.playio.co/mobile-game-ecpm-benchmarks-2026 and https://blog.playio.co/arpdau-benchmarks-mobile-games
- Play target API: https://developer.android.com/google/play/requirements/target-sdk
