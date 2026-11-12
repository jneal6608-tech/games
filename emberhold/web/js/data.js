/* Emberhold — game data & balance. Pure data + formulas, no DOM. */
(function (root) {
  'use strict';
  var EH = root.EH = root.EH || {};

  EH.VERSION = '1.0.0';
  EH.SAVE_VERSION = 1;

  // ---------- number formatting ----------
  var SUFFIX = ['', 'K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'ah'];
  EH.fmt = function (n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + EH.fmt(-n);
    if (n < 1000) return (n < 10 && n % 1 !== 0) ? n.toFixed(1) : String(Math.floor(n));
    var i = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(n) / 3));
    var v = n / Math.pow(1000, i);
    return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + SUFFIX[i];
  };
  EH.fmtTime = function (s) {
    s = Math.max(0, Math.floor(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    if (h > 0) return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  };

  // ---------- upgrades ----------
  // stat(L): value at total level L (workshop + run). cost(r): cinder cost of run level r -> r+1.
  // wcost(w): ember cost of workshop level w -> w+1.
  function exp(base, growth) { return function (l) { return Math.ceil(base * Math.pow(growth, l)); }; }
  var pct = function (v) { return Math.round(v * 100) + '%'; };
  var one = function (v) { return (Math.round(v * 10) / 10).toString(); };

  EH.UPGRADES = [
    // --- attack ---
    { id: 'damage', tab: 'attack', name: 'Damage', icon: '✦', max: 9999,
      stat: function (l) { return 4 * (1 + 0.3 * l) * Math.pow(1.045, l); }, show: EH.fmt,
      cost: exp(5, 1.135), wcost: exp(8, 1.13) },
    { id: 'speed', tab: 'attack', name: 'Attack Speed', icon: '»', max: 60,
      stat: function (l) { return 1 + 0.07 * l; }, show: function (v) { return v.toFixed(2) + '/s'; },
      cost: exp(8, 1.2), wcost: exp(12, 1.22) },
    { id: 'crit', tab: 'attack', name: 'Crit Chance', icon: '✸', max: 30,
      stat: function (l) { return 0.02 * l; }, show: pct,
      cost: exp(14, 1.24), wcost: exp(15, 1.25) },
    { id: 'critMult', tab: 'attack', name: 'Crit Power', icon: '✹', max: 60, unlock: 40,
      stat: function (l) { return 2 + 0.12 * l; }, show: function (v) { return 'x' + v.toFixed(2); },
      cost: exp(18, 1.2), wcost: exp(20, 1.2) },
    { id: 'range', tab: 'attack', name: 'Light Radius', icon: '◎', max: 40,
      stat: function (l) { return 105 + 3 * l; }, show: function (v) { return Math.round(v) + 'm'; },
      cost: exp(10, 1.22), wcost: exp(14, 1.24) },
    { id: 'multishot', tab: 'attack', name: 'Twin Spark', icon: '⁂', max: 25, unlock: 150,
      stat: function (l) { return 0.03 * l; }, show: pct,
      cost: exp(25, 1.26), wcost: exp(30, 1.27) },
    // --- defense ---
    { id: 'health', tab: 'defense', name: 'Vitality', icon: '♥', max: 9999,
      stat: function (l) { return 20 * (1 + 0.32 * l) * Math.pow(1.04, l); }, show: EH.fmt,
      cost: exp(5, 1.135), wcost: exp(8, 1.13) },
    { id: 'regen', tab: 'defense', name: 'Rekindle', icon: '✚', max: 9999,
      stat: function (l) { return 0.35 * l * Math.pow(1.04, l); }, show: function (v) { return EH.fmt(v) + '/s'; },
      cost: exp(7, 1.15), wcost: exp(10, 1.15) },
    { id: 'armor', tab: 'defense', name: 'Stone Ring', icon: '⬟', max: 40,
      stat: function (l) { return 0.015 * l; }, show: pct,
      cost: exp(12, 1.22), wcost: exp(16, 1.24) },
    { id: 'thorns', tab: 'defense', name: 'Scorch', icon: '✺', max: 25, unlock: 90,
      stat: function (l) { return 0.02 * l; }, show: pct,
      cost: exp(20, 1.25), wcost: exp(25, 1.26) },
    // --- utility ---
    { id: 'cinderKill', tab: 'utility', name: 'Cinder Harvest', icon: '◆', max: 100,
      stat: function (l) { return 1 + 0.08 * l; }, show: function (v) { return 'x' + v.toFixed(2); },
      cost: exp(8, 1.17), wcost: exp(12, 1.17) },
    { id: 'cinderWave', tab: 'utility', name: 'Wave Bounty', icon: '❖', max: 100,
      stat: function (l) { return 6 * l; }, show: function (v) { return '+' + EH.fmt(v); },
      cost: exp(10, 1.17), wcost: exp(12, 1.17) },
    { id: 'emberBonus', tab: 'utility', name: 'Ember Yield', icon: '🔥', max: 60, unlock: 60,
      stat: function (l) { return 1 + 0.04 * l; }, show: function (v) { return 'x' + v.toFixed(2); },
      cost: exp(30, 1.22), wcost: exp(25, 1.2) },
    // --- workshop-only ---
    { id: 'startCinders', tab: 'utility', name: 'Kindling Stock', icon: '▲', max: 50, workshopOnly: true,
      stat: function (l) { return 30 * l; }, show: function (v) { return '+' + EH.fmt(v); },
      wcost: exp(10, 1.2) },
    { id: 'banked', tab: 'utility', name: 'Banked Fire', icon: '☾', max: 20, workshopOnly: true,
      stat: function (l) { return 0.05 + 0.01 * l; }, show: function (v) { return pct(v) + '/h'; },
      wcost: exp(40, 1.3) },
    { id: 'boonLuck', tab: 'utility', name: 'Omen Sight', icon: '✧', max: 15, workshopOnly: true, unlock: 0,
      stat: function (l) { return 1 + 0.12 * l; }, show: function (v) { return 'x' + v.toFixed(2); },
      wcost: exp(50, 1.32) }
  ];
  EH.UP = {};
  EH.UPGRADES.forEach(function (u) { EH.UP[u.id] = u; });
  EH.UPG_DESC = {
    damage: 'Damage of each spark.', speed: 'Sparks fired per second.', crit: 'Chance for a critical spark.',
    critMult: 'Damage multiplier of critical sparks.', range: 'How far your light — and your sparks — reach.',
    multishot: 'Chance to fire a second spark at another shade.', health: 'Maximum health of the Ember.',
    regen: 'Health restored every second.', armor: 'Reduces all damage taken.',
    thorns: 'Shades that strike the Ember lose this share of their max health.',
    cinderKill: 'Multiplies Cinders from kills.', cinderWave: 'Bonus Cinders at the end of every wave.',
    emberBonus: 'Multiplies Embers earned this run.', startCinders: 'Start every run with extra Cinders.',
    banked: 'Share of your best run\'s Embers gathered per hour while away.',
    boonLuck: 'Raises the odds of Rare and Epic boons.'
  };

  // ---------- enemies ----------
  EH.ENEMIES = {
    shade:    { name: 'Shade',    hp: 1,    dmg: 1,   speed: 24, r: 9,  cinder: 1,   from: 1 },
    wisp:     { name: 'Wisp',     hp: 0.45, dmg: 0.6, speed: 52, r: 6,  cinder: 1,   from: 3 },
    brute:    { name: 'Brute',    hp: 4.5,  dmg: 2.2, speed: 15, r: 14, cinder: 4,   from: 6 },
    spitter:  { name: 'Spitter',  hp: 0.9,  dmg: 0.8, speed: 22, r: 9,  cinder: 2,   from: 10, ranged: 78 },
    splitter: { name: 'Splitter', hp: 2.2,  dmg: 1.2, speed: 20, r: 12, cinder: 3,   from: 15, split: 3 },
    mite:     { name: 'Mite',     hp: 0.3,  dmg: 0.5, speed: 44, r: 5,  cinder: 0.5, from: 999 },
    boss:     { name: 'Dread',    hp: 16,   dmg: 3.5,   speed: 11, r: 24, cinder: 40,  from: 999, boss: true }
  };
  EH.enemyHp = function (wave, tier) { return 3.4 * Math.pow(1.125, wave) * (1 + 0.1 * wave + 0.012 * wave * wave) * EH.TIERS[tier].hp; };
  EH.enemyDmg = function (wave, tier) { return 0.9 * Math.pow(1.09, wave) * (1 + 0.05 * wave + 0.004 * wave * wave) * EH.TIERS[tier].dmg; };
  EH.enemyCinder = function (wave) { return 1 + wave * 0.22; };
  EH.waveCount = function (wave) { return Math.min(70, Math.floor(7 + wave * 1.15)); };
  EH.WAVE_SPAWN_TIME = 19;
  EH.WAVE_TIME = 25;
  EH.BOSS_EVERY = 10;
  EH.BOON_EVERY = 5;
  EH.emberForWave = function (wave, tier) { return (1 + 0.28 * wave) * EH.TIERS[tier].ember; };

  EH.TIERS = [
    { name: 'Dusk',          hp: 1,     dmg: 1,    ember: 1,   unlockWave: 0 },
    { name: 'Nightfall',     hp: 6,     dmg: 4,    ember: 2.4, unlockWave: 40 },
    { name: 'Midnight',      hp: 40,    dmg: 18,   ember: 5.5, unlockWave: 45 },
    { name: 'Witching Hour', hp: 300,   dmg: 85,   ember: 12,  unlockWave: 50 },
    { name: 'Eclipse',       hp: 2400,  dmg: 420,  ember: 26,  unlockWave: 55 },
    { name: 'The Abyss',     hp: 20000, dmg: 2200, ember: 60,  unlockWave: 60 }
  ];

  // ---------- boons (run-only roguelite picks) ----------
  EH.BOONS = [
    { id: 'kindle',  name: 'Kindling',     rar: 0, max: 99, desc: '+25% damage.' },
    { id: 'quick',   name: 'Quickflame',   rar: 0, max: 99, desc: '+15% attack speed.' },
    { id: 'glow',    name: 'Wide Glow',    rar: 0, max: 5,  desc: '+10% light radius.' },
    { id: 'stone',   name: 'Stoneheart',   rar: 0, max: 99, desc: '+30% max health and a full heal.' },
    { id: 'greed',   name: 'Gleaners',     rar: 0, max: 99, desc: '+30% Cinders from every source.' },
    { id: 'leech',   name: 'Soot Leech',   rar: 0, max: 5,  desc: 'Each kill restores 1% of max health.' },
    { id: 'chain',   name: 'Chain Spark',  rar: 1, max: 4,  desc: 'Sparks leap to +1 nearby shade for 60% damage.' },
    { id: 'sear',    name: 'Searing',      rar: 1, max: 5,  desc: 'Hits burn for 40% damage per second, 3s.' },
    { id: 'frost',   name: 'Hoarfrost',    rar: 1, max: 4,  desc: 'Shades inside your light move 12% slower.' },
    { id: 'slayer',  name: 'Giant Slayer', rar: 1, max: 5,  desc: '+70% damage to Brutes and Dreads.' },
    { id: 'splint',  name: 'Burst',        rar: 1, max: 5,  desc: 'Slain shades have a 25% chance to explode.' },
    { id: 'yield',   name: 'Emberfall',    rar: 1, max: 5,  desc: '+20% Embers this run.' },
    { id: 'nova',    name: 'Pulse',        rar: 2, max: 4,  desc: 'Every 7s, a ring of fire hits everything in your light for 250% damage.' },
    { id: 'glass',   name: 'Glass Flame',  rar: 2, max: 3,  desc: '+80% damage, −25% max health.' },
    { id: 'second',  name: 'Second Wind',  rar: 2, max: 1,  desc: 'Once this run, rekindle at 50% health instead of dying.' },
    { id: 'frenzy',  name: 'Frenzy',       rar: 2, max: 3,  desc: 'Below 50% health: +60% attack speed.' }
  ];
  EH.BOON = {};
  EH.BOONS.forEach(function (b) { EH.BOON[b.id] = b; });
  EH.RARITY = [
    { name: 'Common', color: '#c9b79a', w: 100 },
    { name: 'Rare',   color: '#5ec8ff', w: 34 },
    { name: 'Epic',   color: '#d18cff', w: 9 }
  ];

  // ---------- flames (unlockable characters) ----------
  EH.FLAMES = [
    { id: 'hearth', name: 'Hearthfire', core: '#fff3c4', mid: '#ffb347', out: '#ff6a2b', glow: '255,150,60',
      perk: 'Balanced. +25% health regeneration.', unlock: { type: 'start' } },
    { id: 'storm', name: 'Stormflame', core: '#f1fbff', mid: '#7fd8ff', out: '#3b7bff', glow: '90,170,255',
      perk: 'Sparks always chain to +1 shade. −10% damage.', unlock: { type: 'wave', wave: 25 } },
    { id: 'frost', name: 'Frostfire', core: '#ffffff', mid: '#b6fff2', out: '#35c9b4', glow: '80,230,210',
      perk: 'Shades in your light are slowed 20%. +15% max health.', unlock: { type: 'wave', wave: 45 } },
    { id: 'wild', name: 'Wildfire', core: '#f8ffd0', mid: '#b6f24a', out: '#3fae2a', glow: '150,230,70',
      perk: 'Every hit burns. +20% Cinders.', unlock: { type: 'tier', tier: 2 } },
    { id: 'void', name: 'Voidflame', core: '#ffe9ff', mid: '#d48cff', out: '#7a3cf0', glow: '170,100,255',
      perk: '+15% crit chance, +1.0 crit power, −20% max health.', unlock: { type: 'gems', gems: 400 } }
  ];
  EH.FLAME = {};
  EH.FLAMES.forEach(function (f) { EH.FLAME[f.id] = f; });

  // ---------- abilities (active skills, gem-upgraded) ----------
  EH.ABILITIES = [
    { id: 'flare', name: 'Flare', icon: '✷', cd: 45, max: 6, costs: [0, 40, 80, 140, 220, 320],
      desc: function (l) { return 'Blast every shade on screen for ' + (400 + 150 * l) + '% damage.'; } },
    { id: 'ward', name: 'Ward', icon: '⬡', cd: 60, max: 6, costs: [60, 60, 100, 160, 240, 340], unlockWave: 15,
      desc: function (l) { return 'The Ember takes no damage for ' + (3 + l) + 's.'; } },
    { id: 'stoke', name: 'Stoke', icon: '▲', cd: 75, max: 6, costs: [120, 80, 120, 180, 260, 360], unlockWave: 30,
      desc: function (l) { return 'Double attack speed for ' + (6 + 2 * l) + 's.'; } }
  ];
  EH.ABILITY = {};
  EH.ABILITIES.forEach(function (a) { EH.ABILITY[a.id] = a; });

  // ---------- daily missions ----------
  EH.MISSIONS = [
    { id: 'kills',  text: 'Extinguish {n} shades',     n: [150, 400, 900],  stat: 'kills',     gems: 8 },
    { id: 'waves',  text: 'Clear {n} waves',           n: [20, 45, 80],     stat: 'waves',     gems: 8 },
    { id: 'runs',   text: 'Finish {n} runs',           n: [2, 3, 5],        stat: 'runs',      gems: 6 },
    { id: 'boons',  text: 'Choose {n} boons',          n: [4, 8, 14],       stat: 'boons',     gems: 6 },
    { id: 'bosses', text: 'Defeat {n} Dreads',         n: [1, 3, 5],        stat: 'bosses',    gems: 10 },
    { id: 'abil',   text: 'Use abilities {n} times',   n: [3, 6, 10],       stat: 'abilities', gems: 6 },
    { id: 'spend',  text: 'Buy {n} upgrades in runs',  n: [40, 90, 160],    stat: 'upgrades',  gems: 6 },
    { id: 'work',   text: 'Buy {n} Workshop levels',   n: [3, 6, 10],       stat: 'workshop',  gems: 6 }
  ];
  EH.DAILY_REWARDS = [
    { embers: 40 }, { gems: 10 }, { embers: 120 }, { gems: 15 }, { embers: 300 }, { gems: 25 }, { gems: 50, embers: 500 }
  ];

  // ---------- achievements ----------
  EH.ACHIEVEMENTS = [
    { id: 'wave',   name: 'Night Watch',    text: 'Reach wave {n}',            n: [10, 25, 50, 75, 100, 150, 200], stat: 'bestWaveAny', gems: [5, 10, 20, 30, 40, 60, 100] },
    { id: 'kills',  name: 'Snuffer',        text: 'Extinguish {n} shades',     n: [500, 5000, 25000, 100000, 500000], stat: 'kills', gems: [5, 10, 20, 40, 80] },
    { id: 'bosses', name: 'Dreadbane',      text: 'Defeat {n} Dreads',         n: [1, 10, 50, 200], stat: 'bosses', gems: [5, 15, 30, 60] },
    { id: 'runs',   name: 'Keeper',         text: 'Finish {n} runs',           n: [5, 25, 100, 400], stat: 'runs', gems: [5, 10, 25, 60] },
    { id: 'tier',   name: 'Deeper Dark',    text: 'Unlock difficulty {n}',     n: [2, 3, 4, 5, 6], stat: 'tiersUnlocked', gems: [20, 30, 40, 60, 100] },
    { id: 'flames', name: 'Firekeeper',     text: 'Own {n} flames',            n: [2, 3, 4, 5], stat: 'flamesOwned', gems: [10, 20, 30, 50] },
    { id: 'boons',  name: 'Omen Reader',    text: 'Choose {n} boons',          n: [25, 150, 600], stat: 'boons', gems: [5, 15, 40] },
    { id: 'embers', name: 'Hoard of Light', text: 'Earn {n} Embers in total',  n: [1000, 25000, 500000, 10000000], stat: 'embersEarned', gems: [5, 15, 35, 80] }
  ];

  // ---------- store ----------
  EH.PRODUCTS = [
    { sku: 'keeper_pack', name: "Keeper's Pack", price: '$4.99', once: true, best: true,
      desc: 'Claim every ad reward instantly — no ads, ever. Permanent +50% Embers. +4h offline cap.' },
    { sku: 'starter_pack', name: 'Starter Bundle', price: '$2.99', once: true,
      desc: '350 Gems + 2,500 Embers. One-time offer.', gems: 350, embers: 2500 },
    { sku: 'gems_1', name: 'Pouch of Gems', price: '$0.99', gems: 100, desc: '100 Gems' },
    { sku: 'gems_2', name: 'Sack of Gems', price: '$4.99', gems: 600, desc: '600 Gems  (+20%)' },
    { sku: 'gems_3', name: 'Chest of Gems', price: '$9.99', gems: 1400, desc: '1,400 Gems  (+40%)' },
    { sku: 'gems_4', name: 'Vault of Gems', price: '$19.99', gems: 3200, desc: '3,200 Gems  (+60%)' }
  ];
  EH.PRODUCT = {};
  EH.PRODUCTS.forEach(function (p) { EH.PRODUCT[p.sku] = p; });
  EH.GEM_OFFERS = [
    { id: 'embers_s', gems: 50, hours: 2, name: 'Ember Cache', desc: '2 hours of offline Embers' },
    { id: 'embers_l', gems: 180, hours: 8, name: 'Ember Hoard', desc: '8 hours of offline Embers' }
  ];
  EH.REVIVE_GEMS = 25;
  EH.REROLL_GEMS = 5;
  EH.AD_GEMS = 8;          // gems for a rewarded "free gems" view
  EH.AD_GEMS_PER_DAY = 4;
  EH.OFFLINE_CAP_H = 8;
})(typeof window !== 'undefined' ? window : globalThis);
