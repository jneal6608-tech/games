# Emberhold — game design, economy and monetisation

## Core loop

1. **Run (3–20 min).** The Ember fires by itself at shades entering its light. Kills pay **Cinders**. The player spends
   Cinders on 13 in-run upgrades across Attack, Defense and Utility, casts up to three abilities, and drafts one of three
   **boons** every 5 waves. A Dread (boss) arrives every 10 waves. Waves never stop; the fire eventually dies.
2. **Reward.** The run pays **Embers** (per wave cleared, ×4 for a Dread) and 1 **Gem** per Dread.
3. **Workshop.** Embers buy permanent levels of the same upgrades, unlock four locked upgrades, and raise three
   Workshop-only stats (starting Cinders, offline rate, boon luck).
4. **Go deeper.** Reaching a wave target unlocks the next of six difficulties, each multiplying Embers (×1 to ×60).

## Content at launch

| System | Content |
|---|---|
| Upgrades | 16 (13 usable in runs, 4 of them locked behind Workshop unlocks, 3 Workshop-only) |
| Enemies | Shade, Wisp (fast), Brute (tank), Spitter (ranged), Splitter (splits into Mites), Dread (boss). Each has a distinct silhouette |
| Boons | 16 across Common / Rare / Epic, stackable, including chain sparks, burn, slow aura, periodic pulse, a free revive |
| Flames | 5 playable flames with different rules; unlocked by wave, by difficulty, or with Gems |
| Abilities | Flare (damage), Ward (invulnerability), Stoke (attack speed); 6 levels each, bought with Gems |
| Difficulties | Dusk, Nightfall, Midnight, Witching Hour, Eclipse, The Abyss |
| Retention | 3 daily quests, 7-day login calendar, 8 achievement chains (36 tiers), offline Embers, best-wave records |
| Speed | 1× and 2× from the start, 3× unlocked at wave 20 |

## Onboarding

- First launch opens a three-line premise card and goes straight into a run; there is no menu to read first.
- Coach marks appear only when relevant: first affordable upgrade, the Defense tab after four purchases, the Flare
  button when shades cluster, and the Workshop after the first death.
- The first boon draft and the death/revive screen explain themselves in one sentence each.

## Progression pacing (from `tools/balance.js`, a "buy the cheapest thing" bot at 1× speed)

| Milestone | Run # | Cumulative run time |
|---|---|---|
| First death | 1 | 2–3 min (wave 7–8) |
| First Dread killed, wave 20+ | 3 | ~12 min |
| Wave 30 | 7 | ~50 min |
| Difficulty 2 unlocked | ~12–15 | ~2–3 h |
| Difficulty 3 unlocked | ~38 | ~8 h |

At 3× speed real time is about a third of this. A human who drafts boons well progresses faster than the bot.

## Monetisation

**Principle: no ad is ever shown that the player did not tap for.** Idle players churn on interstitials and leave poor
reviews; they opt into rewarded video at high rates when the reward is concrete.

| Rewarded placement | Reward | When it appears |
|---|---|---|
| Rekindle | Revive once at full health | On death, once per run |
| ×2 Embers | Doubles the run's Embers | Run summary |
| ×2 offline | Doubles Embers gathered while away | On return after 15+ min |
| Free gems | 8 Gems, 4 times a day | Shop |

| Product ID | Type | Price | Contents |
|---|---|---|---|
| `keeper_pack` | Permanent | $4.99 | Every ad reward granted instantly with no ad, +50% Embers forever, +4 h offline cap |
| `starter_pack` | Permanent, one per account | $2.99 | 350 Gems + 2,500 Embers |
| `gems_1` … `gems_4` | Consumable | $0.99 / $4.99 / $9.99 / $19.99 | 100 / 600 / 1,400 / 3,200 Gems |

Gem sinks: ability unlocks and levels (1,500+ Gems to max all three), Voidflame (400), Ember caches, revives (25),
boon rerolls (5, one free per day). Free players earn roughly 30–60 Gems a day from quests, Dreads, daily gifts and videos,
so nothing is locked behind payment.

**Revenue model (illustrative, not a forecast).** With 3 rewarded views per daily player at a $10 blended eCPM, ads yield
about $0.03 per daily player. At a 2% payer rate and $6 average spend in the first month, IAP adds roughly $0.12 per install.
The Keeper's Pack is the anchor: it converts the players who watch the most ads.

## Organic marketing

- Store search: title carries "Idle Defense"; description targets "idle tower defense", "incremental", "roguelite", "offline".
- The fire-in-the-dark image reads in a three-second clip; record late-run footage at 3× with a Pulse + Chain Spark build.
- Post dev-log updates in incremental and tower-defense communities. The "no forced ads" rule is the headline.
- Publish the same HTML5 build on web portals to build audience and extra ad revenue.

## Update roadmap

1. **1.1** — cloud save (Play Games), weekly challenge with fixed seed and leaderboard.
2. **1.2** — relics (permanent passive collectibles from Dreads), two new enemies, two new flames.
3. **1.3** — seasonal events with a cosmetic flame track; optional battle pass.
4. **Later** — guild-free asynchronous tournaments, localisation (text is centralised in `data.js` and `ui.js`).

## Accessibility

Text size (three steps), high-contrast mode (outlines every enemy, shows all health bars), reduce motion (no shake, flashes
or flicker), screen shake toggle, left-handed ability buttons, vibration toggle, damage-number toggle, auto-pick boons so
runs never wait, pause at any time, enemies distinguishable by shape as well as colour, touch targets of 44 px or more,
ARIA labels on controls, and independent music and effects volume.
