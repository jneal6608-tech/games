# Catangle: game design

**One line:** a board full of tangled, bendy cats. Tap a cat and it runs straight ahead off the board, if nothing is in its way.

## Validation summary

| Question | Answer |
|---|---|
| Audience | Casual puzzle players, 18 to 55, skewing female, who play in short breaks. Cat lovers as the hook. Rated for everyone, not directed at children. |
| Closest competitors | Arrow-escape games (Arrows Puzzle Escape and its many lookalikes); Longcat for the theme. See `COMPETITOR_ANALYSIS.md`. |
| Why choose us | Characters and humour, a collection, two extra mechanics, a daily puzzle, and far fewer ads. |
| Core loop | Scan the board, tap a free cat, watch it run, repeat faster as the board opens. A level takes 1 to 3 minutes. |
| Monetisation | Optional rewarded videos, light interstitials from level 12, Remove Ads and fish packs. |
| Scope | Built: full game, 16 coats, 4 rooms, endless levels, daily puzzle, Android shell. |
| Biggest risks | See "Commercial risks" below. |
| First players | Store search keywords, short-form video, cat communities. See `marketing/SHORT_FORM_PLAYBOOK.md`. |

## Rules

- Each cat is a path of grid cells with a head. It moves in the direction its head faces.
- **Clear path:** the cat runs off the board.
- **Blocked:** it bumps, bounces back, and the player loses one of three hearts. No hearts means the level is lost.
- **Sleepy cats** (from level 15) cannot move until a set number of other cats have left. Tapping one costs nothing.
- **Grumpy cats** (from level 30) have a countdown that drops each time another cat leaves. If it reaches zero while the cat is still on the board, the level is lost.
- Every level is generated to be winnable with zero mistakes. Without grumpy cats there are no dead ends at all.

## Progression

| Element | Design |
|---|---|
| Levels | Endless, generated from the level number, so every player gets the same level N. |
| Difficulty | Board grows from 4x5 to 8x11. Cats get longer and bendier. Each chapter of 10 rises and falls, ending in a larger "Big Level". |
| Board shapes | From level 12, some boards are diamonds, donuts, plus signs or hourglasses. |
| Stars | 3 hearts left gives 3 stars. |
| Fish (currency) | 10 per win plus 5 per heart left; doubled on Big Levels; 100 extra and a free hint for each chapter. |
| Coats | 16. Four at the start, four at levels 10, 25, 50 and 100, eight bought with fish (300 to 3,000). Owned coats appear in the player's levels. |
| Rooms | 4 background themes (free, 400, 600, 900 fish). |
| Daily Tangle | One large puzzle a day with both special cats. 60 fish plus 20 per streak day, capped at 200. |

## First session

1. Home screen: one big pulsing Play button.
2. Level 1: five cats, a pointing hand on a cat that can leave, one line of text.
3. Level 2: one line about bumps and facing.
4. Level 3: one line about the Hint button.
5. No ads, no shop prompts and no pop-ups before level 12 except the win screen.

## Monetisation

| Item | How it works | Why it does not hurt retention |
|---|---|---|
| Rewarded: keep going | After a loss, one video restores a heart (or 3 patience). Once per attempt. | Player-initiated; retry is always free. |
| Rewarded: double fish | On the win screen. | Optional bonus. |
| Rewarded: free hint | When hints run out. | Hints are never required. |
| Rewarded: free fish | 50 fish, up to 5 a day, in the shop. | Player-initiated. |
| Interstitial | From level 12, after every third win, never within 150 seconds. | Light compared with the genre; removable. |
| Remove Ads | $3.99 one-time. Removes interstitials only. | Fair offer for engaged players. |
| Fish packs | $1.99 / $4.99 / $9.99. | Speeds up cosmetics and boosters only. |

Evaluated and left out for now: energy or lives timers (they push players away in this genre), subscriptions (too little content yet), paid level packs (levels are endless), loot boxes (policy and trust risk). Prices are placeholders to confirm in Play Console.

## Commercial assessment

Nothing here is a forecast or a guarantee. Most indie mobile games earn very little.

| Scenario | What it looks like | Rough monthly revenue |
|---|---|---|
| Likely without marketing effort | A few hundred installs from search, then decline | Under $50 |
| Reasonable target with steady short-form posting and good store page | 300 to 1,500 daily players | $300 to $2,000 |
| Upside if a clip or keyword takes off | 10,000+ daily players | $5,000+ |

The arithmetic: ad-funded casual games earn roughly $0.01 to $0.05 per daily player; with purchases and good ad placement, up to about $0.10. Revenue is daily players times that number times 30.

### Commercial risks

1. **Discovery.** Downloads are falling market-wide and the store is crowded. Without consistent short-form posting, installs will be low.
2. **Retention.** The base mechanic is simple. If day-7 retention is under about 8%, add content (events, new cat types) before spending effort on marketing.
3. **Copycats and publishers.** The theme is easy to copy.
4. **Untested native layer.** Ads and purchases compile but have not run on a device yet.
5. **Ad income depends on country mix.** US and European players earn several times more per view than others.
6. **Policy.** Play needs a privacy policy, a data-safety form, and 12 testers for 14 days on new personal accounts.

## Built for short-form video

- The board reads in two seconds with the sound off: cats, faces, one tap.
- Quick taps raise the pitch of each meow and show "Combo x5", so fast clears sound and look satisfying.
- A blocked cat goes cross-eyed with a "Bonk!", which makes fail clips funny.
- **Clip mode** (Settings) auto-plays a level with a clean screen, an optional caption and an end card, for recording.
