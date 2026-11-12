// All game content lives here so new charms, tonics, hexes and cosmetics can ship as data-only updates.

export const TIERS = [null,
  { name: 'Dew', chips: 0 }, { name: 'Ember', chips: 5 }, { name: 'Moss', chips: 10 }, { name: 'Brine', chips: 20 },
  { name: 'Honey', chips: 35 }, { name: 'Rose', chips: 60 }, { name: 'Storm', chips: 100 }, { name: 'Void', chips: 160 },
  { name: 'Sun', chips: 250 }, { name: 'Moon', chips: 400 }, { name: 'Elixir', chips: 1000 },
];
export const isSmall = t => t <= 3, isMid = t => t >= 4 && t <= 6, isGrand = t => t >= 7;

// Run structure: 8 orders, 3 brews each (the third is hexed by a rival).
export const ORDERS = 8;
export const ORDER_BASE = [0, 60, 150, 400, 1000, 2600, 6500, 16000, 38000];
export const ROUND_MULT = [1, 1.5, 2.2];
export const ROUND_NAMES = ['Small Brew', 'Big Brew', 'Rival Brew'];
export const ROUND_REWARD = [3, 4, 6];
export const BASE_DROPS = 16, CHARM_SLOTS = 5, TONIC_SLOTS = 2, INTEREST_CAP = 5;
export function targetFor(order, round, stakeMult = 1) {
  const base = order <= ORDERS ? ORDER_BASE[order] : ORDER_BASE[ORDERS] * Math.pow(2.3, order - ORDERS);
  const v = base * ROUND_MULT[round] * stakeMult;
  const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
  return Math.round(v / mag) * mag;
}

export const RARITY = { c: { name: 'Common', w: 60, color: '#9fb4c9' }, u: { name: 'Uncommon', w: 30, color: '#5fd39a' }, r: { name: 'Rare', w: 10, color: '#f2b84b' } };

// Charm hooks: merge(c, st, run) mutates c.chips / c.mult; other hooks are optional.
// c = { t, chain, orbs, dropsLeft, dropsUsed, repeat }
export const CHARMS = [
  { id: 'ladle', name: 'Copper Ladle', rar: 'c', cost: 4, icon: 'ladle', desc: '+4 Mult on every merge.', merge: c => { c.mult += 4; } },
  { id: 'dewcatch', name: 'Dew Catcher', rar: 'c', cost: 4, icon: 'drop', desc: 'Small merges (Ember, Moss) give +15 Potency.', merge: c => { if (isSmall(c.t)) c.chips += 15; } },
  { id: 'emberheart', name: 'Ember Heart', rar: 'c', cost: 5, icon: 'flame', desc: 'Mid merges (Brine, Honey, Rose) give +40 Potency.', merge: c => { if (isMid(c.t)) c.chips += 40; } },
  { id: 'whisk', name: 'Chain Whisk', rar: 'c', cost: 5, icon: 'chain', desc: '+3 Mult per chain step after the first.', merge: c => { c.mult += 3 * (c.chain - 1); } },
  { id: 'clover', name: 'Lucky Clover', rar: 'c', cost: 5, icon: 'clover', desc: '1 in 4 chance: merge scores x2.', merge: (c, st, run) => { if (run.rng.chance(0.25)) { c.mult *= 2; c.lucky = true; } } },
  { id: 'purse', name: "Miser's Purse", rar: 'c', cost: 5, icon: 'coin', desc: '+1 Mult for every 3 Sparks you hold.', merge: (c, st, run) => { c.mult += Math.floor(run.sparks / 3); } },
  { id: 'hourglass', name: 'Hourglass', rar: 'c', cost: 5, icon: 'hourglass', desc: '+3 drops every brew.', drops: 3 },
  { id: 'tithe', name: 'Tithe Bowl', rar: 'c', cost: 4, icon: 'bowl', desc: '+2 Sparks at the end of every brew.', roundEnd: (st, run) => ({ sparks: 2 }) },
  { id: 'cleanpour', name: 'Clean Pour', rar: 'c', cost: 4, icon: 'drop', desc: '+6 Mult on the first merge of each drop.', merge: c => { if (c.chain === 1) c.mult += 6; } },
  { id: 'brimful', name: 'Brimful', rar: 'c', cost: 5, icon: 'bowl', desc: '+1 Mult for every 2 essences in the cauldron.', merge: c => { c.mult += Math.floor(c.orbs / 2); } },
  { id: 'empty', name: 'Empty Vessel', rar: 'c', cost: 5, icon: 'flask', desc: '+12 Mult while 6 or fewer essences are in the cauldron.', merge: c => { if (c.orbs <= 6) c.mult += 12; } },
  { id: 'odd', name: 'Odd Sock', rar: 'c', cost: 4, icon: 'star', desc: 'Merges into Moss, Honey, Storm or Sun: +20 Potency, +2 Mult.', merge: c => { if (c.t % 2 === 1) { c.chips += 20; c.mult += 2; } } },
  { id: 'even', name: 'Even Keel', rar: 'c', cost: 4, icon: 'star', desc: 'Merges into Ember, Brine, Rose, Void or Moon: +20 Potency, +2 Mult.', merge: c => { if (c.t % 2 === 0) { c.chips += 20; c.mult += 2; } } },
  { id: 'thrift', name: 'Thrifty Imp', rar: 'c', cost: 4, icon: 'coin', desc: 'The first reroll in every shop is free.', freeRerolls: 1 },

  { id: 'sprout', name: 'Growing Sprout', rar: 'u', cost: 6, icon: 'sprout', desc: 'Gains +2 Mult for every brew you finish.', init: () => ({ n: 0 }), state: st => `(now +${st.n} Mult)`, merge: (c, st) => { c.mult += st.n; }, roundEnd: st => { st.n += 2; } },
  { id: 'snowball', name: 'Snowball', rar: 'u', cost: 6, icon: 'snow', desc: 'Gains +1 Potency every time anything merges.', init: () => ({ n: 0 }), state: st => `(now +${st.n})`, merge: (c, st) => { if (!c.repeat) st.n += 1; c.chips += st.n; } },
  { id: 'twin', name: 'Twin Flask', rar: 'u', cost: 7, icon: 'flask', desc: 'Small merges score twice.', repeat: c => isSmall(c.t) ? 1 : 0 },
  { id: 'lastdrop', name: 'Last Drop', rar: 'u', cost: 6, icon: 'drop', desc: 'x3 Mult once 3 or fewer drops remain.', merge: c => { if (c.dropsLeft <= 3) c.mult *= 3; } },
  { id: 'gambit', name: 'Opening Gambit', rar: 'u', cost: 6, icon: 'hourglass', desc: 'x2 Mult during the first 5 drops of a brew.', merge: c => { if (c.dropsUsed <= 5) c.mult *= 2; } },
  { id: 'resonance', name: 'Resonance', rar: 'u', cost: 7, icon: 'chain', desc: 'x1.5 Mult on chain steps (2nd merge onward).', merge: c => { if (c.chain >= 2) c.mult *= 1.5; } },
  { id: 'gilded', name: 'Gilded Rim', rar: 'u', cost: 6, icon: 'coin', desc: 'Grand merges (Storm and up) pay +2 Sparks.', merge: (c, st, run) => { if (isGrand(c.t) && !c.repeat) c.sparks += 2; } },
  { id: 'recycler', name: 'Recycler', rar: 'u', cost: 7, icon: 'hourglass', desc: 'Every 6th merge refunds 1 drop.', init: () => ({ n: 0 }), state: st => `(${st.n}/6)`, merge: (c, st) => { if (c.repeat) return; if (++st.n >= 6) { st.n = 0; c.refund += 1; } } },
  { id: 'magnet', name: 'Lodestone', rar: 'u', cost: 7, icon: 'magnet', desc: 'Matching essences gently pull toward each other.', magnet: 9000 },
  { id: 'richstock', name: 'Rich Stock', rar: 'u', cost: 7, icon: 'flame', desc: 'You never draw Dew. Draws start at Ember.', noDew: true },
  { id: 'deep', name: 'Deep Cauldron', rar: 'u', cost: 6, icon: 'bowl', desc: 'The cauldron takes twice as long to boil over.', overflowMult: 2 },

  { id: 'coven', name: 'The Coven', rar: 'r', cost: 9, icon: 'moon', desc: 'x1 Mult, +0.3 for every charm you own.', merge: (c, st, run) => { c.mult *= 1 + 0.3 * run.charms.length; } },
  { id: 'cascade', name: 'Cascade Engine', rar: 'r', cost: 9, icon: 'chain', desc: 'Chain steps count double.', chainBonus: 1 },
  { id: 'grandeur', name: 'Grandeur', rar: 'r', cost: 9, icon: 'star', desc: 'Grand merges (Storm and up) score x3.', merge: c => { if (isGrand(c.t)) c.mult *= 3; } },
  { id: 'mirror', name: 'Silver Mirror', rar: 'r', cost: 9, icon: 'mirror', desc: 'Copies the merge effect of the charm to its left.' },
  { id: 'volatile', name: 'Volatile Flask', rar: 'r', cost: 8, icon: 'flask', desc: 'x4 Mult. 1 in 8 chance to shatter when a brew ends.', merge: c => { c.mult *= 4; }, roundEnd: (st, run) => run.rng.chance(0.125) ? { destroy: true } : null },
  { id: 'mooncharm', name: 'Moon Charm', rar: 'r', cost: 9, icon: 'moon', desc: 'x1 Mult, +0.5 for every rival beaten this run.', state: (st, run) => `(now x${(1 + 0.5 * run.bossesBeaten).toFixed(1)})`, merge: (c, st, run) => { c.mult *= 1 + 0.5 * run.bossesBeaten; } },
];
export const CHARM = Object.fromEntries(CHARMS.map(c => [c.id, c]));
// Charms available from the first run; the rest are unlocked in the Codex with Glints.
export const STARTER_CHARMS = ['ladle', 'dewcatch', 'emberheart', 'whisk', 'clover', 'purse', 'hourglass', 'tithe', 'cleanpour', 'odd', 'even', 'sprout', 'twin', 'lastdrop', 'gilded', 'grandeur'];
export const CHARM_UNLOCK_COST = { c: 150, u: 300, r: 600 };

export const TONICS = [
  { id: 'stir', name: 'Stir', cost: 2, icon: 'whirl', desc: 'Shake the cauldron hard.' },
  { id: 'purge', name: 'Purge', cost: 3, icon: 'drop', desc: 'Remove every Dew from the cauldron.' },
  { id: 'ripen', name: 'Ripen', cost: 3, icon: 'sprout', desc: 'The 3 smallest essences grow one tier.' },
  { id: 'dissolve', name: 'Dissolve', cost: 3, icon: 'flask', desc: 'Remove the 3 largest essences.' },
  { id: 'spare', name: 'Spare Drops', cost: 3, icon: 'hourglass', desc: '+4 drops this brew.' },
  { id: 'golden', name: 'Golden Drop', cost: 3, icon: 'star', desc: 'Your next merge scores x5.' },
  { id: 'pick', name: 'Honey Jar', cost: 2, icon: 'flame', desc: 'Your next essence becomes Honey.' },
];
export const TONIC = Object.fromEntries(TONICS.map(c => [c.id, c]));

export const HEXES = [
  { id: 'thin', name: 'Thin Air', desc: '4 fewer drops this brew.' },
  { id: 'sour', name: 'Sour Batch', desc: 'Small merges score nothing.' },
  { id: 'narrow', name: 'Narrow Neck', desc: 'You can only pour into the middle of the cauldron.' },
  { id: 'fog', name: 'Fog', desc: 'The next essence is hidden.' },
  { id: 'tax', name: 'Imp Tax', desc: 'Lose 1 Spark every 4 drops.' },
  { id: 'silence', name: 'Silence', desc: 'Your leftmost charm is asleep.' },
  { id: 'heavy', name: 'Watered Down', desc: 'Only Dew and Ember are drawn.' },
  { id: 'steep', name: 'Steep Price', desc: 'The target is 30% higher.' },
];
export const HEX = Object.fromEntries(HEXES.map(c => [c.id, c]));

export const FAMILIARS = [
  { id: 'cat', name: 'Soot the Cat', cost: 0, desc: 'A balanced start. No twists.' },
  { id: 'toad', name: 'Gulp the Toad', cost: 400, desc: 'Start with 8 Sparks. Interest caps at 10.' },
  { id: 'moth', name: 'Flit the Moth', cost: 600, desc: '+4 drops every brew, but only 4 charm slots.' },
  { id: 'owl', name: 'Sage the Owl', cost: 900, desc: '6 charm slots, but 2 fewer drops every brew.' },
  { id: 'raven', name: 'Omen the Raven', cost: 1200, desc: 'Start with a random rare charm. Targets are 15% higher.' },
];
export const FAMILIAR = Object.fromEntries(FAMILIARS.map(c => [c.id, c]));

export const STAKES = [
  { name: 'Apprentice', mult: 1, glint: 1, desc: 'The standard recipe.' },
  { name: 'Journeyman', mult: 1.3, glint: 1.25, desc: 'Targets +30%.' },
  { name: 'Adept', mult: 1.6, glint: 1.5, desc: 'Targets +60%. Shop prices +1.' },
  { name: 'Master', mult: 2, glint: 1.75, desc: 'Targets +100%. Shop prices +1. 1 fewer drop.' },
  { name: 'Archmage', mult: 2.6, glint: 2.25, desc: 'Targets +160%. Shop prices +1. 2 fewer drops.' },
];

// Cosmetics never change gameplay. cur: 'g' = Glints, 'm' = Moonstones.
export const ORB_SKINS = [
  { id: 'classic', name: 'Classic Essences', cost: 0, cur: 'g', colors: ['#bfe9ff', '#ff9b54', '#7bd66b', '#4fc3c8', '#ffcf40', '#ff7fa8', '#8f8cf5', '#7a4fd6', '#ffb020', '#e8ecff'] },
  { id: 'candy', name: 'Sugar Shop', cost: 500, cur: 'g', colors: ['#ffd1e8', '#ff8fc7', '#ffa07a', '#ffe27a', '#b6f09c', '#8fe3e0', '#9ec5ff', '#c9a7ff', '#ff6fb5', '#ffffff'] },
  { id: 'deepsea', name: 'Deep Sea', cost: 800, cur: 'g', colors: ['#c8f7f2', '#7fe0d4', '#3fc1c9', '#3a9bd9', '#3f72d6', '#5a55c9', '#7e4fbf', '#b04fb5', '#f06fa0', '#ffe9a8'] },
  { id: 'autumn', name: 'Harvest', cost: 1200, cur: 'g', colors: ['#f6e7c1', '#f2c66d', '#e9a03b', '#dd7a2a', '#c9562b', '#a8412f', '#7d3b3b', '#5b3a4a', '#d9b33f', '#fff6dd'] },
  { id: 'neon', name: 'Neon Lab', cost: 60, cur: 'm', colors: ['#9dfcff', '#39f0ff', '#39ffb0', '#b6ff39', '#fff239', '#ff9d39', '#ff4d6d', '#ff39d4', '#b039ff', '#ffffff'] },
  { id: 'starlit', name: 'Starlit', cost: 90, cur: 'm', colors: ['#dfe6ff', '#b7c4ff', '#93a0f5', '#7f7fe6', '#8a63d6', '#a24fc4', '#c94fa8', '#e86a8c', '#ffb86b', '#fff3c4'] },
  { id: 'founder', name: "Founder's Gold", cost: -1, cur: 'iap', colors: ['#fff6d6', '#ffe9a3', '#ffd96b', '#f7c443', '#eaa92e', '#d98e23', '#c2741d', '#a85c1a', '#ffcf40', '#ffffff'] },
];
export const CAULDRONS = [
  { id: 'iron', name: 'Iron Cauldron', cost: 0, cur: 'g', bg: ['#1c1633', '#2b1f4d'], rim: '#5b4b8a', glow: '#8f7bff' },
  { id: 'forest', name: 'Mossy Kettle', cost: 400, cur: 'g', bg: ['#10261f', '#1d4435'], rim: '#3f7a5a', glow: '#6fe0a0' },
  { id: 'ember', name: 'Ember Forge', cost: 700, cur: 'g', bg: ['#2a1210', '#522017'], rim: '#a04a2a', glow: '#ff9a4d' },
  { id: 'tide', name: 'Tidepool', cost: 1000, cur: 'g', bg: ['#0e2238', '#15406a'], rim: '#3f7fb5', glow: '#6fd0ff' },
  { id: 'rosegold', name: 'Rose Gold', cost: 50, cur: 'm', bg: ['#33172a', '#5c2748'], rim: '#d98aa8', glow: '#ffc2d8' },
  { id: 'cosmos', name: 'Cosmos', cost: 80, cur: 'm', bg: ['#0a0a1f', '#1a1147'], rim: '#6a5acd', glow: '#c8b8ff' },
];

// Daily missions: 3 are picked per day (seeded by date). key = stat counted during play.
export const MISSIONS = [
  { id: 'm_merge', key: 'merges', n: 120, reward: 60, text: 'Merge 120 essences' },
  { id: 'm_rounds', key: 'rounds', n: 6, reward: 70, text: 'Finish 6 brews' },
  { id: 'm_boss', key: 'bosses', n: 2, reward: 90, text: 'Beat 2 rivals' },
  { id: 'm_chain', key: 'chain4', n: 3, reward: 70, text: 'Make 3 chains of 4 or more' },
  { id: 'm_grand', key: 'grand', n: 2, reward: 80, text: 'Create 2 Storm essences or bigger' },
  { id: 'm_buy', key: 'charmsBought', n: 4, reward: 60, text: 'Buy 4 charms in runs' },
  { id: 'm_tonic', key: 'tonicsUsed', n: 3, reward: 60, text: 'Use 3 tonics' },
  { id: 'm_score', key: 'bigScore', n: 1, reward: 90, text: 'Score 1,000 Potency in one brew' },
  { id: 'm_runs', key: 'runs', n: 2, reward: 60, text: 'Complete 2 runs' },
  { id: 'm_daily', key: 'dailyPlayed', n: 1, reward: 80, text: 'Play the Daily Brew' },
];
export const MISSION_BONUS_MOON = 2;

// Achievements read lifetime stats. g = Glints, m = Moonstones.
export const ACHIEVEMENTS = [
  { id: 'a_first', name: 'First Pour', text: 'Finish your first brew', stat: 'rounds', n: 1, g: 50, m: 0 },
  { id: 'a_r50', name: 'Busy Hands', text: 'Finish 50 brews', stat: 'rounds', n: 50, g: 200, m: 3 },
  { id: 'a_r250', name: 'Tireless', text: 'Finish 250 brews', stat: 'rounds', n: 250, g: 500, m: 8 },
  { id: 'a_boss1', name: 'Rivalry', text: 'Beat your first rival', stat: 'bosses', n: 1, g: 80, m: 1 },
  { id: 'a_boss25', name: 'Undisputed', text: 'Beat 25 rivals', stat: 'bosses', n: 25, g: 400, m: 6 },
  { id: 'a_win1', name: 'Master Brewer', text: 'Complete all 8 orders', stat: 'wins', n: 1, g: 300, m: 10 },
  { id: 'a_win5', name: 'Brewing Legend', text: 'Win 5 runs', stat: 'wins', n: 5, g: 800, m: 15 },
  { id: 'a_m1k', name: 'Thousand Bubbles', text: 'Merge 1,000 essences', stat: 'merges', n: 1000, g: 150, m: 2 },
  { id: 'a_m10k', name: 'Sea of Bubbles', text: 'Merge 10,000 essences', stat: 'merges', n: 10000, g: 600, m: 8 },
  { id: 'a_chain6', name: 'Chain Reaction', text: 'Make a chain of 6', stat: 'bestChain', n: 6, g: 150, m: 2 },
  { id: 'a_chain10', name: 'Avalanche', text: 'Make a chain of 10', stat: 'bestChain', n: 10, g: 400, m: 5 },
  { id: 'a_moon', name: 'Moonrise', text: 'Create a Moon essence', stat: 'moons', n: 1, g: 300, m: 5 },
  { id: 'a_elixir', name: 'Grand Elixir', text: 'Merge two Moons', stat: 'elixirs', n: 1, g: 600, m: 10 },
  { id: 'a_10k', name: 'Potent', text: 'Score 10,000 Potency in one brew', stat: 'bestRound', n: 10000, g: 200, m: 3 },
  { id: 'a_100k', name: 'Overproof', text: 'Score 100,000 Potency in one brew', stat: 'bestRound', n: 100000, g: 500, m: 8 },
  { id: 'a_o4', name: 'Regular Customer', text: 'Reach order 4', stat: 'bestOrder', n: 4, g: 100, m: 1 },
  { id: 'a_o6', name: 'In Demand', text: 'Reach order 6', stat: 'bestOrder', n: 6, g: 200, m: 3 },
  { id: 'a_stake3', name: 'Adept', text: 'Win on Adept stake', stat: 'bestStakeWon', n: 3, g: 500, m: 10 },
  { id: 'a_stake5', name: 'Archmage', text: 'Win on Archmage stake', stat: 'bestStakeWon', n: 5, g: 1500, m: 25 },
  { id: 'a_collect', name: 'Collector', text: 'Unlock 24 charms', stat: 'charmsUnlocked', n: 24, g: 300, m: 5 },
  { id: 'a_all', name: 'Full Codex', text: 'Unlock every charm', stat: 'charmsUnlocked', n: CHARMS.length, g: 800, m: 15 },
  { id: 'a_daily7', name: 'Creature of Habit', text: 'Play 7 Daily Brews', stat: 'dailies', n: 7, g: 300, m: 5 },
  { id: 'a_streak7', name: 'Loyal Apprentice', text: 'Reach a 7 day login streak', stat: 'bestStreak', n: 7, g: 300, m: 5 },
  { id: 'a_rich', name: 'Hoarder', text: 'Hold 30 Sparks in a run', stat: 'bestSparks', n: 30, g: 150, m: 2 },
];

// 7 day login calendar (loops). g = Glints, m = Moonstones.
export const DAILY_REWARDS = [{ g: 50 }, { g: 75 }, { g: 100, m: 2 }, { g: 125 }, { g: 150 }, { g: 200, m: 3 }, { g: 300, m: 10 }];

// Glints paid when a run ends.
export const GLINT_PER_ROUND = 6, GLINT_PER_BOSS = 20, GLINT_WIN = 150;
export const REVIVE_MOON = 5, EXCHANGE = { moon: 10, glint: 250 };

// Google Play products. Prices here are only fallbacks for display; the real price always comes from Play.
export const IAP = [
  { sku: 'moon_80', type: 'consumable', moon: 80, name: 'Pouch of Moonstones', price: '$0.99' },
  { sku: 'moon_450', type: 'consumable', moon: 450, name: 'Jar of Moonstones', price: '$4.99', tag: '+12%' },
  { sku: 'moon_1000', type: 'consumable', moon: 1000, name: 'Chest of Moonstones', price: '$9.99', tag: '+24%' },
  { sku: 'moon_2400', type: 'consumable', moon: 2400, name: 'Vault of Moonstones', price: '$19.99', tag: '+49%' },
  { sku: 'starter_pack', type: 'nonconsumable', moon: 200, glint: 1000, skin: 'founder', name: "Founder's Pack", price: '$1.99', once: true, desc: "200 Moonstones, 1,000 Glints and the exclusive Founder's Gold essences." },
  { sku: 'remove_ads', type: 'nonconsumable', name: 'Remove Ads', price: '$3.99', once: true, desc: 'No more ads between runs. Reward videos stay optional and you get 1 free revive every run.' },
];
export const IAP_BY_SKU = Object.fromEntries(IAP.map(p => [p.sku, p]));
