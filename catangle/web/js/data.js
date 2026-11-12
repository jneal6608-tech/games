// Catangle — content & economy tables. Tune numbers here.

export const COATS = [
  { id: 'ginger', name: 'Ginger', base: '#F7A553', stripe: '#E5852B', line: '#8B4A16', pattern: 'bands', cost: 0 },
  { id: 'cloud', name: 'Cloud', base: '#FFF9F0', line: '#A3948A', pattern: 'plain', cost: 0 },
  { id: 'smoke', name: 'Smoke', base: '#93A0B8', stripe: '#7A869F', line: '#444C60', pattern: 'bands', cost: 0 },
  { id: 'midnight', name: 'Midnight', base: '#4A4560', line: '#211E2E', pattern: 'plain', cost: 0 },
  { id: 'tabby', name: 'Tabby', base: '#B98A5E', stripe: '#7D5536', line: '#4E321D', pattern: 'bands', level: 10 },
  { id: 'tuxedo', name: 'Tuxedo', base: '#2F2D3A', stripe: '#FFFFFF', line: '#15141C', pattern: 'patch', level: 25 },
  { id: 'siamese', name: 'Siamese', base: '#F3E3C8', head: '#6B4A3A', tip: '#6B4A3A', line: '#5A3F31', pattern: 'plain', level: 50 },
  { id: 'calico', name: 'Calico', base: '#FFF7EA', stripe: '#F29A3F', stripe2: '#4A3B36', line: '#7A5B48', pattern: 'patch2', level: 100 },
  { id: 'mint', name: 'Mint', base: '#8FDDBE', stripe: '#63C4A0', line: '#2F7F66', pattern: 'bands', cost: 300 },
  { id: 'berry', name: 'Berry', base: '#F58FB0', stripe: '#E46A93', line: '#93375A', pattern: 'bands', cost: 300 },
  { id: 'lilac', name: 'Lilac', base: '#B9A2F2', line: '#5B46A0', pattern: 'plain', cost: 500 },
  { id: 'sky', name: 'Sky', base: '#7CC4F5', stripe: '#FFFFFF', line: '#2D6FA3', pattern: 'patch', cost: 500 },
  { id: 'bee', name: 'Bumble', base: '#FFD23F', stripe: '#3B3024', line: '#3B3024', pattern: 'bands', cost: 800 },
  { id: 'tiger', name: 'Tiger', base: '#FF8A2A', stripe: '#2B1B12', line: '#5A2A0A', pattern: 'bands', cost: 1200 },
  { id: 'cosmic', name: 'Cosmic', base: '#3B2A78', stripe: '#F9D65C', stripe2: '#8E6BFF', line: '#1B1140', pattern: 'patch2', cost: 2000 },
  { id: 'golden', name: 'Golden', base: '#FFD76A', stripe: '#FFF3B8', line: '#A8751A', pattern: 'patch', cost: 3000 },
];

export const THEMES = [
  { id: 'cozy', name: 'Cozy Room', bg: ['#FFE9CF', '#FFD0B5'], panel: '#F2B48C', tile: '#FFF4E3', tile2: '#FFEBD3', ink: '#5A3526', cost: 0 },
  { id: 'garden', name: 'Garden', bg: ['#D9F2C4', '#A9DDA0'], panel: '#6FB07A', tile: '#F1FBE4', tile2: '#E2F5CF', ink: '#274B32', cost: 400 },
  { id: 'sakura', name: 'Sakura', bg: ['#FFE3EE', '#F9BDD3'], panel: '#E58BAB', tile: '#FFF5F9', tile2: '#FFE7F0', ink: '#6B2944', cost: 600 },
  { id: 'night', name: 'Night Roof', bg: ['#2F3463', '#1B1D3D'], panel: '#151733', tile: '#474D86', tile2: '#3E4479', ink: '#F4F1FF', dark: true, cost: 900 },
];

export const ECON = {
  winBase: 10, winPerHeart: 5, bossMult: 2,
  chapterChest: 100,
  dailyReward: 60, streakBonus: 20, streakBonusCap: 140,
  hintCost: 40, lureCost: 80,
  hintPack: { n: 3, cost: 100 },
  freeFish: 50, freeFishPerDay: 5,
  startHints: 3, startLures: 1,
  interstitialFromLevel: 12, interstitialEveryWins: 3, interstitialMinGapSec: 150,
};

// In-app products. Prices shown are fallbacks; the store supplies the real localized price.
export const PRODUCTS = [
  { sku: 'remove_ads', title: 'Remove Ads', desc: 'No more ads between levels. Bonus videos stay optional.', price: '$3.99', kind: 'entitlement' },
  { sku: 'fish_small', title: 'Bowl of Fish', desc: '1,000 fish', price: '$1.99', fish: 1000 },
  { sku: 'fish_medium', title: 'Bucket of Fish', desc: '3,000 fish + 5 hints', price: '$4.99', fish: 3000, hints: 5 },
  { sku: 'fish_large', title: 'Boatload of Fish', desc: '8,000 fish + 15 hints + 5 treats', price: '$9.99', fish: 8000, hints: 15, lures: 5 },
];

export const PRIVACY_URL = 'https://example.com/catangle/privacy'; // TODO(founder): host docs/store/privacy-policy.md and put the URL here.
export const VERSION = '1.0.0';
