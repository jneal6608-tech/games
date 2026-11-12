# Monetisation plan

**Model: free-to-play hybrid (rewarded ads + light interstitials + optional IAP).** This is the model the growth segment of the market uses, and it is the differentiator against the paid genre leaders. No paid services or servers are used.

## Evaluation
| Option | Decision | Why |
|---|---|---|
| Rewarded video | **Yes, primary ad format** | Opt-in, highest eCPM, fits natural moments. Placements: revive (once per run), double run payout, one free shop reroll per shop, double daily gift, 40 Glints (5/day) |
| Interstitials | **Yes, restrained** | Only between runs, never in the first 3 runs, at most one per 4 minutes, removed by Remove Ads |
| Banners | No | Low revenue, hurts a portrait play field |
| Premium currency packs | **Yes** | 80 / 450 / 1,000 / 2,400 Moonstones at $0.99 / $4.99 / $9.99 / $19.99 (set real prices in Play Console) |
| Remove Ads ($3.99) | **Yes** | Removes interstitials and gives a free revive each run without a video; reward videos stay optional |
| Founder's Pack ($1.99, once) | **Yes** | Low-price first purchase: 200 Moonstones, 1,000 Glints, exclusive style |
| Cosmetics | **Yes** | Sold for Glints and Moonstones |
| Paid power / pay-to-win | No | Would break the roguelike and the reviews |
| Subscription / battle pass | Not at launch | Needs live content cadence; see NEXT_STEPS |
| Paid premium version | Not now | Could be tested later as a separate "no ads" SKU |

## Purchase safety (implemented)
- Google Play Billing Library 8.0 (`android/.../BillingManager.kt`).
- Every purchase's signature is verified on the device against your Play licence key before the game is told (`PurchaseVerifier.kt`, unit-tested with genuine, tampered and forged data).
- Each purchase token is delivered once: the game keeps a list of delivered tokens in the save, and the app keeps a second list; consumables are consumed and one-time items acknowledged only after the reward is saved. Interrupted purchases are re-delivered on next launch; "Restore purchases" re-checks Play.
- Pending, cancelled and failed purchases show a message and grant nothing.
- **If no licence key is configured the store stays closed**, so a misconfigured build cannot charge a player and fail to deliver.
- Limit: on-device verification stops casual tampering, not a determined attacker on a rooted phone. Server-side verification is stronger but needs paid infrastructure, which I did not add without your approval.

## Disclosures for the store listing
"Contains ads" and "In-app purchases" must both be ticked. Item price range $0.99–$19.99. No loot boxes or paid random items (the in-run shop uses only in-run Sparks, which cannot be bought).

## What is not live yet
The builds use Google's public **test** ad unit IDs and have no licence key, so they show test ads and the store is closed. Going live needs your AdMob and Play Console accounts (see `NEXT_STEPS.md`). No revenue estimate is given: it would depend on install volume and retention that only a real launch can measure.
