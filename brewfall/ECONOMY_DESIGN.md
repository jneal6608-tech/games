# Economy design

Three currencies, each with one job.

| Currency | Scope | Earned by | Spent on |
|---|---|---|---|
| **Sparks** (orange bolt) | Inside one run, reset every run | Finishing brews (3/4/6), unused drops (up to +4), interest (1 per 5 held, cap 5), some charms | Charms (4–9), tonics (2–3), recipes (3+), rerolls (2, +1 each) |
| **Glints** (gold four-point star) | Permanent soft currency | Run payout, daily gift, missions, achievements, Daily Brew bonus, optional reward videos | Unlocking charms into the shop pool, familiars, essence styles, cauldrons |
| **Moonstones** (pale blue gem) | Permanent premium currency | Achievements (1–25 each, 157 total), day 3/6/7 of the daily gift (15 per week), daily mission bonus (2/day), optional purchase | Premium cosmetics, one revive per run (5), exchange 10 → 250 Glints |

## Earning rates (Glints)
- Run payout: 6 per brew finished + 20 per rival beaten + 150 for a full win, multiplied by stake (x1 to x2.25). A typical early run that ends in order 4 pays about 114; a win pays 454 at Apprentice. A reward video can double it.
- Daily gift: 50 / 75 / 100 / 125 / 150 / 200 / 300 over seven days (1,000 per week), optionally doubled by video.
- Daily missions: three per day worth 60–90 each (about 210 per day).
- Daily Brew: +50 for the first attempt each day.
- Reward video in the shop: 40 Glints, five per day.
- Achievements: 50–1,500 each, about 9,400 in total.

## Prices
- Charms: 150 common, 300 uncommon, 600 rare. 15 of the 31 are locked at the start (5,550 Glints for all).
- Familiars: 400 / 600 / 900 / 1,200.
- Essence styles: 500 / 800 / 1,200 Glints; premium styles 60 and 90 Moonstones; Founder's Gold only in the Founder's Pack.
- Cauldrons: 400 / 700 / 1,000 Glints; premium 50 and 80 Moonstones.

**Pacing intent:** a free player who plays three runs and does their missions earns very roughly 600–800 Glints a day, so a new unlock every day or two and the whole gameplay catalogue (charms + familiars, 8,650) in about two weeks, with cosmetics as the long tail. These are design estimates from the tables above, not measured player data.

## Fairness rules built into the code
- Nothing that changes run strength is sold for real money directly. Moonstones can be exchanged for Glints, which speeds up *unlocking options*; unlocked charms still have to be found and bought with Sparks in a run.
- Free players earn Moonstones (about 29 a week from gifts and missions plus achievements), enough for premium cosmetics over time.
- A revive is limited to one per run however it is paid for, so spending cannot brute-force a win.
- Balances can never go negative; every spend is checked (`pay`, `buyUnlock` in `web/src/save.js`), and covered by tests.
- Balances persist in the save file with a checksum and backups (see `TECHNICAL_NOTES.md`).

## Tuning knobs
All numbers live in `web/src/data.js` (`GLINT_*`, `DAILY_REWARDS`, `MISSIONS`, `ACHIEVEMENTS`, `CHARM_UNLOCK_COST`, skin costs, `IAP`).
