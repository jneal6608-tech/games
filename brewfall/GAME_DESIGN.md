# Brewfall — game design

**Pitch:** Drop essences into a cauldron; matching essences merge into bigger ones. Every merge scores Potency x Mult. Hit each order's target before you run out of drops, then spend Sparks on charms that bend the scoring rules. Free-to-play, portrait, one thumb, offline.

## Core loop
1. **Brew (30–90 s):** slide to aim, release to drop. Same essences merge (10 tiers: Dew → Ember → Moss → Brine → Honey → Rose → Storm → Void → Sun → Moon; two Moons make a Grand Elixir). Reach the Potency target within 16 drops.
2. **Payout:** Sparks for finishing, for unused drops, and interest (1 per 5 held, capped).
3. **Shop:** 3 charms, 2 tonics, 1 recipe, reroll. Then the next brew.
4. **Run:** 8 orders x 3 brews (Small, Big, Rival). The third is hexed by a rival. Beat all 8 to win and unlock the next stake; continue in Endless if you like.

## Depth
- **Scoring:** `Potency (by essence size, + recipes) x Mult (1 + chain steps + recipes)`, then charms apply **left to right**, so "+4 Mult then x3" beats "x3 then +4".
- **The cauldron is never emptied** during a run (a beaten rival only skims off Dew and Ember). Space is a resource: bigger essences score more but fill the pot, and if essences sit above the line for 2.5 s it boils over and the run ends.
- **31 charms** in three rarities: flat bonuses, conditional bonuses (small/mid/grand merges, odd/even, chain, cauldron fullness, Sparks held), scaling charms, economy charms, a physics charm (Lodestone pulls matches together), a copier (Silver Mirror) and a risky x4.
- **7 tonics** (one-use): Stir, Purge, Ripen, Dissolve, Spare Drops, Golden Drop, Honey Jar.
- **8 rival hexes:** fewer drops, small merges score nothing, narrow pour zone, hidden next essence, Spark tax, leftmost charm asleep, only small draws, +30% target.
- **5 familiars** (starting conditions) and **5 stakes** (difficulty ladder with higher Glint payouts).

## Meta and retention
Daily gift (7-day loop), 3 daily missions + completion bonus, 24 achievements, Daily Brew (same seed for everyone each day), charm Codex to fill, cosmetic essence styles and cauldrons, stakes ladder, lifetime records. All detailed in `ECONOMY_DESIGN.md`.

## Onboarding
Non-blocking coach tips on the first run (aim, merge, target and chains, shop, rival hex, boil-over). They can be replayed from Settings. The first targets (60 / 90 / 130) are beatable with no charms.

## Identity
Round, glossy essences with small faces on a deep-purple alchemy backdrop; gold title lettering. All art is drawn by code at runtime; all sound and music is synthesised at runtime. No third-party art, fonts or audio.

## Balance status
Targets were tuned with a bot that plays full runs with the real physics (`tests/bot.mjs`): it clears orders 1–5 almost always and wins roughly 5–8% of Apprentice runs (40-run samples). **No human has playtested balance yet**; expect to tune `ORDER_BASE` and charm prices in `web/src/data.js` after real play.
