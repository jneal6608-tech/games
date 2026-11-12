// Brewfall: screens, menus and flow. Game rules live in run.js, content in data.js.
import * as D from './data.js';
import { Run } from './run.js';
import { Board, orbSprite, fmt } from './board.js';
import { RADII } from './physics.js';
import { hashStr } from './rng.js';
import * as S from './save.js';
import * as A from './audio.js';
import { native, ads, store, on, dev, isNative } from './platform.js';

const $ = s => document.querySelector(s);
const app = $('#app'), modals = $('#modals'), toasts = $('#toasts');
const P = () => S.profile.p;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- original vector icons ----------
const PATH = {
  glint: 'M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z', moonstone: 'M12 2l8 6-3 12H7L4 8z M12 5.2L7.3 8.7 9 17h6l1.7-8.3z', spark: 'M13 2L4 14h6l-1 8 9-12h-6z',
  ladle: 'M15 3h2v9a5 5 0 1 1-6.5 4.8H6V15h4.5A5 5 0 0 1 15 12z', drop: 'M12 2s-7 9-7 13a7 7 0 0 0 14 0c0-4-7-13-7-13z', flame: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 2 4-5z',
  chain: 'M8 7a5 5 0 1 0 3 9l-1.4-1.6A3 3 0 1 1 11 10l1.5-1.4A5 5 0 0 0 8 7zm8 0a5 5 0 0 0-3 1l1.4 1.6A3 3 0 1 1 13 14l-1.5 1.4A5 5 0 1 0 16 7z',
  clover: 'M12 11a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm-4.5 4.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm9 0a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zM11 13h2v9h-2z',
  coin: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm-1 3v6h2V9z', hourglass: 'M6 2h12v3l-4.5 7 4.5 7v3H6v-3l4.5-7L6 5z',
  bowl: 'M2 10h20a10 10 0 0 1-7 9.5V22H9v-2.5A10 10 0 0 1 2 10z', flask: 'M9 2h6v2h-1v5l5.5 10a2 2 0 0 1-1.8 3H6.3a2 2 0 0 1-1.8-3L10 9V4H9z',
  star: 'M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.5 5.7 21.1l1.5-7L2 9.3l7-.8z', sprout: 'M11 22v-9C6 13 3 10 3 5c5 0 8 2 9 6 1-5 4-8 9-8 0 6-3 10-8 10v9z',
  snow: 'M11 2h2v7.3l6.3-3.6 1 1.7L14 11v2l6.3 3.6-1 1.7L13 14.7V22h-2v-7.3l-6.3 3.6-1-1.7L10 13v-2L3.7 7.4l1-1.7L11 9.3z',
  magnet: 'M4 3h5v9a3 3 0 0 0 6 0V3h5v9a8 8 0 0 1-16 0zM4 3h5v3H4zm11 0h5v3h-5z', mirror: 'M12 2a6 7 0 0 1 1 13.9V22h-2v-6.1A6 7 0 0 1 12 2zm0 2.5a3.5 4.5 0 1 0 0 9 3.5 4.5 0 0 0 0-9z',
  moon: 'M15 2a10 10 0 1 0 7 15A9 9 0 0 1 15 2z', whirl: 'M12 3a9 9 0 1 0 9 9h-2.5A6.5 6.5 0 1 1 12 5.5V9l5-4.5L12 0z',
  gear: 'M10 2h4l.6 2.6 2.3 1.3 2.5-.8 2 3.5-2 1.8v2.6l2 1.8-2 3.5-2.5-.8-2.3 1.3L14 22h-4l-.6-2.6-2.3-1.3-2.5.8-2-3.5 2-1.8v-2.6l-2-1.8 2-3.5 2.5.8 2.3-1.3zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  close: 'M5 3l7 7 7-7 2 2-7 7 7 7-2 2-7-7-7 7-2-2 7-7-7-7z', back: 'M14 3l2 2-7 7 7 7-2 2-9-9z', lock: 'M7 10V7a5 5 0 0 1 10 0v3h2v12H5V10zm2 0h6V7a3 3 0 0 0-6 0z', check: 'M9 16.2L4.8 12l-2 2L9 20.2 21.2 8l-2-2z',
  trophy: 'M6 2h12v2h4v3a5 5 0 0 1-5 5 6 6 0 0 1-4 2.8V18h4v4H7v-4h4v-3.2A6 6 0 0 1 7 12a5 5 0 0 1-5-5V4h4zm0 4H4v1a3 3 0 0 0 2 2.8zm12 0v3.8A3 3 0 0 0 20 7V6z',
  cart: 'M2 3h3l3 11h10l3-8H8.5L8 4zM9 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm9 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', book: 'M4 3h7a3 3 0 0 1 1 .2A3 3 0 0 1 13 3h7v17h-7l-1 1-1-1H4zm2 2v13h5V5zm7 0v13h5V5z',
  list: 'M4 4h3v3H4zm5 0h11v3H9zM4 10.5h3v3H4zm5 0h11v3H9zM4 17h3v3H4zm5 0h11v3H9z', gift: 'M3 8h18v5h-1v9H4v-9H3zm8 0V6a3 3 0 1 0-3 2zm2 0h3a3 3 0 1 0-3-2zm-2 5H6v7h5zm2 0v7h5v-7z',
  play: 'M6 3l15 9-15 9z', pause: 'M5 3h5v18H5zm9 0h5v18h-5z', video: 'M3 5h13v4l5-3v12l-5-3v4H3z', sun: 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM11 0h2v4h-2zm0 20h2v4h-2zM0 11h4v2H0zm20 0h4v2h-4z',
};
const ico = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24"><path fill-rule="evenodd" d="${PATH[n] || PATH.star}"/></svg>`;
const G = n => `<span class="g">${ico('glint')} ${fmt(n)}</span>`, M = n => `<span class="m">${ico('moonstone')} ${fmt(n)}</span>`, SP = n => `<span class="s">${ico('spark')} ${n}</span>`;
const cost = (c, cur) => cur === 'm' ? M(c) : G(c);

// ---------- small UI helpers ----------
let screen = '', board = null, run = null, backAction = null;
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = msg; toasts.appendChild(t); setTimeout(() => t.remove(), 2200); }
function modal(html, { dismiss = false, cls = '' } = {}) {
  const ov = document.createElement('div'); ov.className = 'ov ' + cls; ov.innerHTML = `<div class="dlg">${html}</div>`; ov.dataset.dismiss = dismiss ? '1' : '';
  ov.addEventListener('click', e => { if (e.target === ov && dismiss) closeModal(ov); }); modals.appendChild(ov); return ov;
}
function closeModal(ov) { (ov || modals.lastElementChild)?.remove(); }
const closeAll = () => { modals.innerHTML = ''; };
function render(name, html, back) { if (board && name !== 'game') { board.destroy(); board = null; } screen = name; backAction = back || null; app.innerHTML = html; }
const header = (title, back = 'home') => `<div class="top"><button class="iconbtn" data-act="${back}">${ico('back')}</button><h2>${title}</h2>${wallet()}</div>`;
const wallet = () => `<button class="pill" data-act="store" data-tab="free">${G(P().glints)}</button><button class="pill" data-act="store" data-tab="moon">${M(P().moons)}</button>`;
const click = () => { A.sfx('click'); };
function confirmDlg(title, text, yes, fn) { const ov = modal(`<h3>${title}</h3><p>${text}</p><div class="acts"><button class="btn pri" data-k="y">${yes}</button><button class="btn" data-k="n">Cancel</button></div>`, { dismiss: true }); ov.querySelector('[data-k=y]').onclick = () => { closeModal(ov); fn(); }; ov.querySelector('[data-k=n]').onclick = () => closeModal(ov); }
// Offer a reward video; calls fn() only if the reward was earned.
function rewarded(placement, fn) {
  if (!ads.rewardedReady()) return toast('No video available right now. Try again in a moment.');
  A.suspend(); ads.showRewarded(placement, (ok, err) => { A.resume(); if (ok) { P().stats.adsWatched++; fn(); } else if (err !== 'dismissed') toast('The video did not finish, so no reward this time.'); });
}
const adBtn = (label, act, extra = '') => ads.rewardedReady() ? `<button class="btn grn" data-act="${act}" ${extra}>${ico('video')} ${label}</button>` : '';

// ---------- HOME ----------
function home() {
  const p = P(), ready = S.missionsReady() + S.achReady().length, d = S.dailyState();
  const cont = p.run ? `<button class="btn pri big" data-act="continue">${ico('play')} Continue run</button><button class="btn wide" data-act="setup">New run</button>` : `<button class="btn pri big" data-act="setup">${ico('play')} Play</button>`;
  const db = p.dailyBrew.date === S.today() && p.dailyBrew.done ? `Best today: ${fmt(p.dailyBrew.best)}` : '+50 Glints for your first brew today';
  render('home', `<div class="top"><button class="iconbtn" data-act="settings">${ico('gear')}</button><span class="grow"></span>${wallet()}</div>
  <div class="home"><div class="logo"><b>Brewfall</b><span>merge · brew · break the recipe</span></div>
  <div class="hero"><canvas id="hero" width="560" height="360"></canvas></div>
  <div class="col">${cont}<button class="btn blu wide two" data-act="daily"><span>${ico('sun')} Daily Brew</span><small>${db}</small></button></div>
  <div class="nav"><button data-act="store" data-tab="looks">${ico('cart')}Shop</button><button data-act="codex">${ico('book')}Codex</button>
  <button data-act="missions">${ico('list')}Missions${ready ? `<i class="badge">${ready}</i>` : ''}</button><button data-act="dailyReward">${ico('gift')}Daily gift${d.available ? '<i class="badge">!</i>' : ''}</button></div></div>`);
  drawHero();
  if (d.available && !home.shown) { home.shown = true; setTimeout(() => screen === 'home' && !modals.childElementCount && dailyReward(), 350); }
}
function drawHero() {
  const c = $('#hero'); if (!c) return; const g = c.getContext('2d'), skin = D.ORB_SKINS.find(s => s.id === P().equip.orb);
  const lay = [[9, 280, 215], [7, 130, 262], [6, 410, 275], [5, 215, 108], [4, 372, 152], [3, 68, 150], [2, 478, 190], [1, 300, 60], [2, 150, 60], [1, 440, 80]];
  for (const [t, x, y] of lay) { const r = RADII[t], sp = orbSprite(t, skin), d = (r + 3) * 2; g.drawImage(sp, x - d / 2, y - d / 2, d, d); }
}

// ---------- RUN SETUP ----------
function setup() {
  const p = P(), eq = p.equip;
  render('setup', `${header('New run')}<div class="scroll"><div class="sect">Familiar</div>
  ${D.FAMILIARS.map(f => { const own = p.familiars.includes(f.id); return `<button class="item ${own ? '' : 'locked'}" style="width:100%;text-align:left;${eq.familiar === f.id ? 'border-color:var(--gold)' : ''}" data-act="${own ? 'pickFam' : 'store'}" data-tab="fam" data-id="${f.id}"><span class="ic">${ico(own ? 'moon' : 'lock')}</span><span class="grow"><div class="nm">${f.name}</div><div class="ds">${f.desc}</div></span>${own ? (eq.familiar === f.id ? ico('check', 'g') : '') : G(f.cost)}</button>`; }).join('')}
  <div class="sect">Stake</div>
  ${D.STAKES.map((s, i) => { const open = i < p.stakeUnlocked; return `<button class="item ${open ? '' : 'locked'}" style="width:100%;text-align:left;${eq.stake === i ? 'border-color:var(--gold)' : ''}" ${open ? `data-act="pickStake" data-i="${i}"` : ''}><span class="ic">${open ? i + 1 : ico('lock')}</span><span class="grow"><div class="nm">${s.name}</div><div class="ds">${open ? `${s.desc} Glints x${s.glint}.` : `Win a run on ${D.STAKES[i - 1].name} to unlock.`}</div></span>${eq.stake === i ? ico('check', 'g') : ''}</button>`; }).join('')}
  </div><div style="padding:8px 14px 14px"><button class="btn pri big" data-act="start">${ico('play')} Start brewing</button></div>`, home);
}
function startRun(mode) {
  const p = P();
  run = mode === 'daily' ? new Run({ seed: hashStr('daily' + S.today()), mode: 'daily', familiar: 'cat', stake: 0, pool: D.STARTER_CHARMS })
    : new Run({ seed: (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0, familiar: p.equip.familiar, stake: p.equip.stake, pool: p.charms });
  if (mode === 'daily') { S.progress('dailyPlayed'); if (!(p.dailyBrew.date === S.today())) { p.dailyBrew = { date: S.today(), best: 0, done: false }; S.earn(50); toast(`Daily Brew bonus: ${G(50)}`); } }
  persistRun(); game();
}
function persistRun() { if (!run) return; if (board && run.phase === 'round') board.snapshot(); P().run = run.toJSON(); S.save(); }

// ---------- GAME ----------
const charmBtn = (c, i, where) => { const d = D.CHARM[c.id]; return `<button class="charm ${c.asleep ? 'asleep' : ''}" style="--rc:${D.RARITY[d.rar].color}" data-act="charmInfo" data-i="${i}" data-w="${where}">${ico(d.icon)}</button>`; };
function tray(where) {
  let h = run.charms.map((c, i) => charmBtn(c, i, where)).join('');
  for (let i = run.charms.length; i < run.charmSlots; i++) h += '<span class="charm empty"></span>';
  h += '<span class="sep"></span>';
  for (let i = 0; i < D.TONIC_SLOTS; i++) { const t = run.tonics[i]; h += t ? `<button class="charm tonic" data-act="tonic" data-i="${i}" data-w="${where}">${ico(D.TONIC[t].icon)}</button>` : '<span class="charm tonic empty"></span>'; }
  return h;
}
function game() {
  const hx = run.hex ? D.HEX[run.hex] : null;
  render('game', `<div class="hud"><div class="r1"><div class="title">${run.mode === 'daily' ? 'Daily Brew · ' : ''}Order ${run.order}${run.endless ? '' : '/' + D.ORDERS} · ${D.ROUND_NAMES[run.round]}</div><span class="pill" id="sparks"></span><button class="iconbtn" data-act="pause">${ico('pause')}</button></div>
  <div class="scoreline"><span class="sc" id="score">0</span><span class="tg">/ ${fmt(run.target)} Potency</span></div><div class="bar" id="bar"><i></i></div>
  ${hx ? `<div class="hex">Rival hex · ${hx.name}: ${hx.desc}</div>` : ''}</div>
  <div class="stage"><div class="cvwrap"><canvas id="cv"></canvas></div><div class="side"><div class="box" id="drops"><small>Drops</small><b>0</b></div><div class="box"><small>Next</small><canvas id="next" width="80" height="80"></canvas></div><div class="box" id="multbox"><small>Chain</small><b>x1</b></div></div></div>
  <div class="tray" id="tray"></div>`, pause);
  const p = P();
  board = new Board($('#cv'), run, { skin: D.ORB_SKINS.find(s => s.id === p.equip.orb), theme: D.CAULDRONS.find(s => s.id === p.equip.cauldron) }, { onScore, onChange: () => { hud(); persistRun(); }, onEnd: roundEnd, onTutorial: tutorial });
  hud(); tutorial('start'); if (hx) tutorial('hex');
  if (dev) window.__bf = { board, run, S, D };
}
function hud() {
  if (screen !== 'game') return;
  $('#score').textContent = fmt(run.score); const bar = $('#bar'); bar.firstElementChild.style.width = Math.min(100, run.score / run.target * 100) + '%'; bar.classList.toggle('done', run.reached);
  $('#sparks').innerHTML = SP(run.sparks); const dr = $('#drops'); dr.lastElementChild.textContent = run.dropsLeft; dr.classList.toggle('low', run.dropsLeft <= 3);
  $('#multbox').lastElementChild.textContent = 'x' + Math.max(1, run.chain);
  $('#tray').innerHTML = tray('game');
  const nc = $('#next'), g = nc.getContext('2d'); g.clearRect(0, 0, 80, 80);
  if (run.hex === 'fog') { g.fillStyle = '#a99fce'; g.font = '900 44px system-ui'; g.textAlign = 'center'; g.fillText('?', 40, 56); }
  else if (run.dropsLeft > 1) { const t = run.queue[1], sp = orbSprite(t, board.skin), d = Math.min(72, (RADII[t] + 3) * 2); g.drawImage(sp, 40 - d / 2, 40 - d / 2, d, d); }
}
function onScore(res) {
  hud(); const p = P(); p.stats.merges++; S.progress('merges'); if (res.chain === 4) S.progress('chain4');
  const els = document.querySelectorAll('#tray .charm:not(.empty):not(.tonic)'); els.forEach(e => { e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); });
}
const HINTS = {
  start: ['Slide your finger to aim, then lift it to pour an essence.', 'Tap to continue'],
  dropped: ['Two matching essences merge into a bigger one. Every merge scores Potency.', null],
  merged: ['Reach the target before your drops run out. One merge that sets off another is a chain, and chains multiply your score.', null],
  shop: ['Spend Sparks on charms. Each charm changes how merges score for the rest of the run. Tap a charm you own to read or sell it.', null],
  hex: ['A rival has hexed this brew. Read the red banner: the rule changes until you beat it.', null],
  full: ['Careful! If essences stay above the dotted line the cauldron boils over and the run ends.', null],
};
const ORDERED = ['start', 'dropped', 'merged'];
function tutorial(key) {
  const p = P(); if (p.tut[key] || !HINTS[key]) return;
  const i = ORDERED.indexOf(key); if (i > 0 && !p.tut[ORDERED[i - 1]]) return;
  if (document.querySelector('.hint')) { if (i < 0) return; document.querySelector('.hint').remove(); }
  p.tut[key] = 1; S.save();
  const el = document.createElement('div'); el.className = 'hint'; el.innerHTML = `${HINTS[key][0]}<small>Tap to dismiss</small>`; el.onclick = () => el.remove(); app.appendChild(el);
  setTimeout(() => el.remove(), 9000);
}
function pause() {
  if (!board || board.paused || modals.childElementCount) return; board.paused = true; persistRun();
  const ov = modal(`<h3>Paused</h3><p>Order ${run.order} · ${D.ROUND_NAMES[run.round]}<br>Your run is saved automatically.</p><div class="acts"><button class="btn pri" data-k="r">${ico('play')} Resume</button><button class="btn" data-k="s">${ico('gear')} Settings</button><button class="btn" data-k="h">Save and quit to menu</button><button class="btn" data-k="a" style="color:var(--bad)">Abandon run</button></div>`);
  ov.querySelector('[data-k=r]').onclick = () => { closeModal(ov); board.paused = false; };
  ov.querySelector('[data-k=s]').onclick = () => { closeModal(ov); settings(() => { game.resume(); }); };
  ov.querySelector('[data-k=h]').onclick = () => { closeAll(); home(); };
  ov.querySelector('[data-k=a]').onclick = () => confirmDlg('Abandon run?', 'You keep the Glints earned so far.', 'Abandon', () => { closeAll(); run.loseRound(); summary(); });
}
game.resume = () => { game(); };

function roundEnd(result, reason) {
  persistRun();
  if (result === 'won') {
    const wasBossOrder = run.order, res = run.winRound(); S.noteRound(run, res.wasBoss); persistRun();
    const ov = modal(`<h3>${res.wasBoss ? 'Rival beaten!' : 'Brew complete!'}</h3><div class="lines">${res.lines.map(l => `<div><span>${esc(l[0])}</span>${SP('+' + l[1])}</div>`).join('')}</div>
    ${res.destroyed.length ? `<p class="bad">${esc(res.destroyed.join(', '))} shattered!</p>` : ''}<div class="bigwin">${SP('+' + res.pay)}</div>
    <div class="acts"><button class="btn pri" data-k="go">${res.won ? 'Deliver the final order' : 'To the shop'}</button></div>`);
    A.sfx('coin');
    ov.querySelector('[data-k=go]').onclick = () => { closeModal(ov); res.won ? victory() : shop(); };
    return;
  }
  // lost
  const why = reason === 'overflow' ? 'The cauldron boiled over.' : `Out of drops at ${fmt(run.score)} / ${fmt(run.target)} Potency.`;
  if (run.revived) { run.loseRound(); return summary(why); }
  const p = P(), free = p.iap.removeAds;
  const ov = modal(`<h3>Brew failed</h3><p>${why}</p><p>Revive once per run: the cauldron is emptied and you get fresh drops.</p><div class="acts">
  ${free ? `<button class="btn grn" data-k="free">Free revive (Remove Ads perk)</button>` : (ads.rewardedReady() ? `<button class="btn grn" data-k="ad">${ico('video')} Watch a video to revive</button>` : '')}
  <button class="btn blu ${p.moons < D.REVIVE_MOON ? 'off' : ''}" data-k="moon">Revive for ${M(D.REVIVE_MOON)}</button><button class="btn" data-k="end">End run</button></div>`);
  const doRevive = () => { closeModal(ov); run.revive(); board.revive(); hud(); persistRun(); toast('Revived! Fresh cauldron.'); };
  const q = k => ov.querySelector(`[data-k=${k}]`);
  if (q('free')) q('free').onclick = doRevive;
  if (q('ad')) q('ad').onclick = () => rewarded('revive', doRevive);
  q('moon').onclick = () => { if (S.pay(D.REVIVE_MOON, 'm')) { A.sfx('buy'); doRevive(); } else { A.sfx('deny'); toast('Not enough Moonstones.'); } };
  q('end').onclick = () => { closeModal(ov); run.loseRound(); summary(why); };
}
function victory() {
  A.sfx('win');
  const ov = modal(`<h3>Master Brewer!</h3><p>All ${D.ORDERS} orders delivered on ${run.stakeDef.name} stake.</p><div class="bigwin g">${ico('trophy')}</div><p>Keep this run going in Endless mode, or cash out now.</p>
  <div class="acts"><button class="btn pri" data-k="end">Cash out</button><button class="btn" data-k="more">Endless mode</button></div>`);
  ov.querySelector('[data-k=end]').onclick = () => { closeModal(ov); run.phase = 'over'; summary('', true); };
  ov.querySelector('[data-k=more]').onclick = () => { closeModal(ov); run.continueEndless(); persistRun(); shop(); };
}
function summary(why = '', won = false) {
  const r = run, st = r.stats, base = S.finishRun(r), p = P(); won = won || r.bossesBeaten >= D.ORDERS;
  let doubled = false; closeAll();
  const newStake = won && r.mode === 'run' && r.stake + 2 === p.stakeUnlocked && r.stake + 1 < D.STAKES.length;
  const ov = modal(`<h3>${won ? 'Run complete!' : 'Run over'}</h3>${why ? `<p>${why}</p>` : ''}<div class="lines">
  <div><span>Reached</span><span>Order ${Math.min(r.order, r.endless ? 99 : D.ORDERS)}${r.endless ? ' (endless)' : ''}</span></div><div><span>Brews finished</span><span>${r.roundsWon}</span></div>
  <div><span>Best brew</span><span>${fmt(st.bestRound)}</span></div><div><span>Longest chain</span><span>x${st.bestChain}</span></div><div><span>Merges</span><span>${st.merges}</span></div></div>
  ${newStake ? `<p class="good">New stake unlocked: ${D.STAKES[r.stake + 1].name}</p>` : ''}
  <div class="bigwin" id="sumg">${G('+' + base)}</div><div class="acts">${base > 0 ? adBtn('Double it', '', 'data-k="dbl"') : ''}<button class="btn pri" data-k="again">${ico('play')} Play again</button><button class="btn" data-k="home">Menu</button></div>`);
  const leave = fn => { closeAll(); run = null; maybeInterstitial(() => { fn(); if (S.achReady().length) toast('Achievement ready to claim!'); if (won || p.stats.runs === 5) native.review(); }); };
  const dbl = ov.querySelector('[data-k=dbl]');
  if (dbl) dbl.onclick = () => rewarded('double', () => { if (doubled) return; doubled = true; S.earn(base); A.sfx('coin'); ov.querySelector('#sumg').innerHTML = G('+' + base * 2); dbl.remove(); });
  ov.querySelector('[data-k=again]').onclick = () => leave(setup); ov.querySelector('[data-k=home]').onclick = () => leave(home);
}
// Interstitials only between runs, never in the first 3 runs, at most one every 4 minutes, never for paying players.
function maybeInterstitial(next) {
  const p = P(), now = Date.now();
  if (p.iap.removeAds || p.stats.runs < 3 || now - p.lastInterstitial < 240000) return next();
  p.lastInterstitial = now; S.save(); A.suspend(); ads.showInterstitial(() => { A.resume(); next(); });
}

// ---------- IN-RUN SHOP ----------
function shop() {
  if (!run.shop) { run.leaveShop(); persistRun(); return game(); }
  const sh = run.shop, hexNext = run.round === 2 ? D.HEX[run.hexOrder[(run.order - 1) % run.hexOrder.length]] : null;
  const offer = (o, i, def, act, rc, extra = '') => `<button class="offer ${o.sold ? 'sold' : ''}" style="--rc:${rc}" data-act="${act}" data-i="${i}"><span class="ic">${ico(def.icon)}</span><span class="nm">${def.name}</span><span class="ds">${def.desc}${extra}</span><span class="price">${o.sold ? 'Sold' : SP(o.cost)}</span></button>`;
  const rc = sh.recipe, tn = D.TIERS[rc.tier], lv = run.recipes[rc.tier] || 0;
  render('shop', `<div class="top"><h2>Shop</h2><span class="pill">${SP(run.sparks)}</span></div>
  <div class="scroll"><div class="card small dim">Next: <b style="color:var(--ink)">Order ${run.order} · ${D.ROUND_NAMES[run.round]}</b> · target ${fmt(D.targetFor(run.order, run.round, run.stakeDef.mult * (run.familiar === 'raven' ? 1.15 : 1)))}${hexNext ? `<br><span class="bad">Rival hex: ${hexNext.name}. ${hexNext.desc}</span>` : ''}</div>
  <div class="sect">Charms · ${run.charms.length}/${run.charmSlots} slots</div><div class="offers">${sh.charms.map((o, i) => { const d = D.CHARM[o.id]; return offer(o, i, d, 'buyCharm', D.RARITY[d.rar].color); }).join('') || '<p class="dim small">You own every charm on offer.</p>'}</div>
  <div class="sect">Tonics (one use) and recipe</div><div class="offers">${sh.tonics.map((o, i) => offer(o, i, D.TONIC[o.id], 'buyTonic', '#9ff')).join('')}
  <button class="offer ${rc.sold ? 'sold' : ''}" style="--rc:var(--gold)" data-act="buyRecipe"><span class="ic"><canvas id="rcv" width="72" height="72" style="width:36px;height:36px"></canvas></span><span class="nm">${tn.name} Recipe</span><span class="ds">Merges that make ${tn.name}: +${Math.round(tn.chips * 0.5)} Potency, +1 Mult. (Lv ${lv})</span><span class="price">${rc.sold ? 'Sold' : SP(rc.cost)}</span></button></div>
  <div class="row" style="margin-top:12px"><button class="btn grow" data-act="reroll">Reroll charms ${run.freeRerolls > 0 ? '<span class="good">Free</span>' : SP(run.rerollCost)}</button>${!shop.adUsed ? adBtn('Free reroll', 'adReroll') : ''}</div>
  <div class="sect">Your charms (tap to inspect, reorder or sell)</div><div class="tray" style="padding:0">${tray('shop')}</div></div>
  <div style="padding:8px 14px 14px"><button class="btn pri big" data-act="nextRound">${ico('play')} Start ${D.ROUND_NAMES[run.round]}</button></div>`, null);
  const c = $('#rcv'); if (c) { const sp = orbSprite(rc.tier, D.ORB_SKINS.find(s => s.id === P().equip.orb)); c.getContext('2d').drawImage(sp, 0, 0, 72, 72); }
  tutorial('shop');
}
const BUYMSG = { full: 'No free slot. Sell something first.', poor: 'Not enough Sparks.', gone: 'Already sold.' };
function buyRes(r) { if (r === 'ok') { A.sfx('buy'); native.haptic(12); persistRun(); shop(); } else { A.sfx('deny'); toast(BUYMSG[r]); } }
function charmInfo(i, where) {
  const c = run.charms[i]; if (!c) return; const d = D.CHARM[c.id], st = d.state ? d.state(c.st, run) : '';
  if (board) board.paused = true;
  const ov = modal(`<div class="center" style="font-size:54px;color:${D.RARITY[d.rar].color}">${ico(d.icon)}</div><h3>${d.name}</h3><p style="color:${D.RARITY[d.rar].color};font-weight:800">${D.RARITY[d.rar].name}</p><p>${d.desc} <b class="good">${st}</b></p>${c.asleep ? '<p class="bad">Asleep for this brew (Silence hex).</p>' : ''}
  <div class="acts">${where === 'shop' ? `<div class="row"><button class="btn grow" data-k="l">${ico('back')} Move left</button><button class="btn grow" data-k="r">Move right</button></div><button class="btn" data-k="sell">Sell for ${SP(run.sellValue(i))}</button>` : ''}<button class="btn pri" data-k="x">Close</button></div>`, { dismiss: true });
  const done = () => { closeModal(ov); if (board) board.paused = false; };
  ov.addEventListener('click', e => { if (e.target === ov && board) board.paused = false; });
  ov.querySelector('[data-k=x]').onclick = done;
  if (where === 'shop') {
    ov.querySelector('[data-k=sell]').onclick = () => { run.sellCharm(i); A.sfx('coin'); done(); persistRun(); shop(); };
    ov.querySelector('[data-k=l]').onclick = () => { run.moveCharm(i, -1); done(); persistRun(); shop(); };
    ov.querySelector('[data-k=r]').onclick = () => { run.moveCharm(i, 1); done(); persistRun(); shop(); };
  }
}
function tonicTap(i, where) {
  const id = run.tonics[i]; if (!id) return; const d = D.TONIC[id];
  if (where === 'game') {
    if (board) board.paused = true;
    const ov = modal(`<div class="center" style="font-size:54px;color:#9ff">${ico(d.icon)}</div><h3>${d.name}</h3><p>${d.desc}</p><div class="acts"><button class="btn pri" data-k="u">Use now</button><button class="btn" data-k="x">Keep</button></div>`);
    ov.querySelector('[data-k=u]').onclick = () => { closeModal(ov); board.paused = false; if (board.useTonic(i)) { P().stats.tonicsUsed = (P().stats.tonicsUsed || 0) + 1; S.progress('tonicsUsed'); persistRun(); } };
    ov.querySelector('[data-k=x]').onclick = () => { closeModal(ov); board.paused = false; };
  } else toast(`${d.name}: ${d.desc} Use it during a brew.`);
}

// ---------- META STORE ----------
let storeTab = 'looks';
function storeScreen(tab) {
  storeTab = tab || storeTab; const p = P(); let body = '';
  const buyBtn = (own, eq, kind, id, c, cur) => own ? (eq === null ? `<span class="good h">${ico('check')}</span>` : eq ? `<span class="good h">Equipped</span>` : `<button class="btn sm" data-act="equip" data-kind="${kind}" data-id="${id}">Equip</button>`) : `<button class="btn sm ${S.canPay(c, cur) ? 'pri' : 'off'}" data-act="unlock" data-kind="${kind}" data-id="${id}">${cost(c, cur)}</button>`;
  if (storeTab === 'looks') {
    body = `<div class="sect">Essence styles</div>${D.ORB_SKINS.map(s => { const own = p.orbSkins.includes(s.id); return `<div class="item"><span class="grow"><div class="nm">${s.name}</div><div class="sw">${s.colors.map(c => `<i style="background:${c}"></i>`).join('')}</div></span>${s.cur === 'iap' && !own ? `<button class="btn sm" data-act="store" data-tab="moon">Founder's Pack</button>` : buyBtn(own, p.equip.orb === s.id, 'orb', s.id, s.cost, s.cur)}</div>`; }).join('')}
    <div class="sect">Cauldrons</div>${D.CAULDRONS.map(s => { const own = p.cauldrons.includes(s.id); return `<div class="item"><span class="ic" style="background:linear-gradient(180deg,${s.bg[0]},${s.bg[1]});border-color:${s.rim};color:${s.glow}">${ico('bowl')}</span><span class="grow"><div class="nm">${s.name}</div><div class="ds">Cosmetic only</div></span>${buyBtn(own, p.equip.cauldron === s.id, 'cauldron', s.id, s.cost, s.cur)}</div>`; }).join('')}`;
  } else if (storeTab === 'fam') {
    body = `<div class="sect">Familiars change how a run starts</div>${D.FAMILIARS.map(f => { const own = p.familiars.includes(f.id); return `<div class="item ${own ? '' : 'locked'}"><span class="ic">${ico(own ? 'moon' : 'lock')}</span><span class="grow"><div class="nm">${f.name}</div><div class="ds">${f.desc}</div></span>${buyBtn(own, null, 'familiar', f.id, f.cost, 'g')}</div>`; }).join('')}`;
  } else if (storeTab === 'moon') {
    const iap = d => { const owned = (d.sku === 'remove_ads' && p.iap.removeAds) || (d.sku === 'starter_pack' && p.iap.starter); return `<div class="item"><span class="ic" style="color:var(--moon)">${ico(d.sku === 'remove_ads' ? 'video' : d.sku === 'starter_pack' ? 'gift' : 'moonstone')}</span><span class="grow"><div class="nm">${d.name} ${d.tag ? `<span class="good tiny">${d.tag} bonus</span>` : ''}</div><div class="ds">${d.desc || `${fmt(d.moon)} Moonstones`}</div></span>${owned ? `<span class="good h">Owned</span>` : `<button class="btn sm pri" data-act="iap" data-sku="${d.sku}">${esc(store.price(d.sku, d.price))}</button>`}</div>`; };
    body = `${store.available() ? '' : '<div class="card small dim">Purchases are available in the Google Play version of Brewfall.</div>'}<div class="sect">Special offers</div>${D.IAP.filter(d => d.once).map(iap).join('')}<div class="sect">Moonstones</div>${D.IAP.filter(d => !d.once).map(iap).join('')}
    <p class="tiny dim center">Moonstones buy cosmetics, revives and Glints. Everything that affects play can be earned for free. Purchases are optional and processed by Google Play.</p><button class="btn sm wide" data-act="restore">Restore purchases</button>`;
  } else {
    const ag = p.adGlints.date === S.today() ? p.adGlints.n : 0;
    body = `<div class="sect">Free Glints</div><div class="item"><span class="ic">${ico('video')}</span><span class="grow"><div class="nm">Watch a video</div><div class="ds">Earn ${G(40)} · ${5 - ag} left today</div></span>${ag < 5 && ads.rewardedReady() ? `<button class="btn sm grn" data-act="adGlints">Watch</button>` : `<span class="dim small">${ag >= 5 ? 'Back tomorrow' : 'No video ready'}</span>`}</div>
    <div class="item"><span class="ic" style="color:var(--moon)">${ico('moonstone')}</span><span class="grow"><div class="nm">Exchange</div><div class="ds">${M(D.EXCHANGE.moon)} for ${G(D.EXCHANGE.glint)}</div></span><button class="btn sm ${p.moons >= D.EXCHANGE.moon ? 'blu' : 'off'}" data-act="exchange">Exchange</button></div>
    <div class="sect">Other ways to earn</div><div class="card small dim">Finish brews and beat rivals (Glints are paid when a run ends), complete daily missions, claim achievements, collect your daily gift and play the Daily Brew.</div>`;
  }
  const tabs = [['looks', 'Looks'], ['fam', 'Familiars'], ['moon', 'Moonstones'], ['free', 'Free']];
  render('store', `${header('Shop')}<div class="tabs">${tabs.map(([k, n]) => `<button class="${storeTab === k ? 'on' : ''}" data-act="store" data-tab="${k}">${n}</button>`).join('')}</div><div class="scroll">${body}</div>`, home);
}
function unlock(kind, id) { const r = S.buyUnlock(kind, id); if (r === 'ok') { A.sfx('buy'); toast('Unlocked!'); if (kind === 'orb') P().equip.orb = id; if (kind === 'cauldron') P().equip.cauldron = id; S.save(); } else { A.sfx('deny'); toast(r === 'poor' ? 'Not enough currency yet.' : 'Unavailable.'); } }

// ---------- CODEX ----------
function codex() {
  const p = P();
  const list = D.CHARMS.map(d => { const own = p.charms.includes(d.id), c = D.CHARM_UNLOCK_COST[d.rar]; return `<div class="item ${own ? '' : 'locked'}" style="--rc:${own ? D.RARITY[d.rar].color : '#5d5480'}"><span class="ic">${ico(own ? d.icon : 'lock')}</span><span class="grow"><div class="nm">${d.name} <span class="tiny" style="color:${D.RARITY[d.rar].color}">${D.RARITY[d.rar].name}</span></div><div class="ds">${d.desc}</div></span>${own ? '' : `<button class="btn sm ${S.canPay(c, 'g') ? 'pri' : 'off'}" data-act="unlock" data-kind="charm" data-id="${d.id}">${G(c)}</button>`}</div>`; }).join('');
  render('codex', `${header('Charm Codex')}<div class="scroll"><div class="card small dim">${p.charms.length}/${D.CHARMS.length} charms discovered. Unlocked charms can appear in the shop during your runs.</div>${list}
  <div class="sect">Essences</div><div class="card small dim">${D.TIERS.slice(1, 11).map((t, i) => `${i + 1}. ${t.name}`).join(' → ')} → two Moons make a Grand Elixir.</div>
  <div class="sect">How scoring works</div><div class="card small dim">Every merge scores <b>Potency x Mult</b>. Bigger essences are worth more Potency. Mult starts at 1 and rises by 1 for each chain step. Charms add to both, from left to right, so order matters.</div></div>`, home);
}

// ---------- MISSIONS + ACHIEVEMENTS ----------
let misTab = 'daily';
function missionsScreen(tab) {
  misTab = tab || misTab; const p = P(); let body = '';
  if (misTab === 'daily') {
    const ms = S.missions();
    body = ms.list.map((m, i) => { const d = D.MISSIONS.find(x => x.id === m.id), done = m.prog >= d.n; return `<div class="item"><span class="grow"><div class="nm">${d.text}</div><div class="ds">${m.prog}/${d.n} · reward ${G(d.reward)}</div><div class="prog"><i style="width:${m.prog / d.n * 100}%"></i></div></span>${m.claimed ? `<span class="good h">${ico('check')}</span>` : `<button class="btn sm ${done ? 'pri' : 'off'}" data-act="claimMission" data-i="${i}">Claim</button>`}</div>`; }).join('')
      + `<div class="card small dim center">Claim all three for a bonus of ${M(D.MISSION_BONUS_MOON)} ${ms.bonus ? '<span class="good">(claimed)</span>' : ''}<br>New missions every day.</div>`;
  } else if (misTab === 'ach') {
    body = D.ACHIEVEMENTS.map(a => { const v = Math.min(a.n, p.stats[a.stat] || 0), done = v >= a.n, got = p.ach[a.id]; return `<div class="item ${got ? 'locked' : ''}"><span class="ic">${ico('trophy')}</span><span class="grow"><div class="nm">${a.name}</div><div class="ds">${a.text} · ${G(a.g)}${a.m ? ' ' + M(a.m) : ''}</div><div class="prog"><i style="width:${v / a.n * 100}%"></i></div></span>${got ? `<span class="good h">${ico('check')}</span>` : `<button class="btn sm ${done ? 'pri' : 'off'}" data-act="claimAch" data-id="${a.id}">Claim</button>`}</div>`; }).join('');
  } else {
    const s = p.stats, rows = [['Runs played', s.runs], ['Runs won', s.wins], ['Brews finished', s.rounds], ['Rivals beaten', s.bosses], ['Essences merged', fmt(s.merges)], ['Best brew', fmt(s.bestRound)], ['Longest chain', 'x' + s.bestChain], ['Furthest order', s.bestOrder], ['Highest stake won', s.bestStakeWon ? D.STAKES[s.bestStakeWon - 1].name : 'None yet'], ['Best login streak', s.bestStreak + ' days'], ['Daily Brews played', s.dailies], ['Glints earned', fmt(s.glintsEarned)]];
    body = `<div class="card">${rows.map(r => `<div class="stat"><span class="dim">${r[0]}</span><span>${r[1]}</span></div>`).join('')}</div>`;
  }
  const tabs = [['daily', 'Daily', S.missionsReady()], ['ach', 'Achievements', S.achReady().length], ['stats', 'Records', 0]];
  render('missions', `${header('Missions')}<div class="tabs">${tabs.map(([k, n, b]) => `<button class="${misTab === k ? 'on' : ''}" data-act="missions" data-tab="${k}">${n}${b ? `<i class="badge">${b}</i>` : ''}</button>`).join('')}</div><div class="scroll">${body}</div>`, home);
}
function dailyReward() {
  const d = S.dailyState();
  const days = D.DAILY_REWARDS.map((r, i) => `<div class="day ${i === d.day && d.available ? 'now' : (i < d.day || (i === d.day && !d.available)) ? 'past' : ''}">Day ${i + 1}<br>${G(r.g)}${r.m ? '<br>' + M(r.m) : ''}</div>`).join('');
  const ov = modal(`<h3>Daily gift</h3><p>${d.available ? `Day ${d.day + 1} of 7 · streak ${d.streak}` : 'Already collected today. Come back tomorrow!'}</p><div class="days">${days}</div>
  <div class="acts">${d.available ? `<button class="btn pri" data-k="c">Collect</button>${ads.rewardedReady() ? `<button class="btn grn" data-k="d">${ico('video')} Collect double Glints</button>` : ''}` : `<button class="btn pri" data-k="x">Close</button>`}</div>`, { dismiss: !d.available });
  const fin = dbl => { const r = S.claimDaily(dbl); closeModal(ov); if (r) { A.sfx('coin'); toast(`Collected ${G(r.g)}${r.m ? ' ' + M(r.m) : ''}`); } if (screen === 'home') home(); };
  const q = k => ov.querySelector(`[data-k=${k}]`);
  if (q('c')) q('c').onclick = () => fin(false); if (q('d')) q('d').onclick = () => rewarded('daily', () => fin(true)); if (q('x')) q('x').onclick = () => closeModal(ov);
}

// ---------- SETTINGS ----------
function settings(onBack) {
  const p = P(), s = p.settings; settings.back = typeof onBack === 'function' ? onBack : home;
  const tg = (k, label) => `<div class="item"><span class="grow nm">${label}</span><button class="toggle ${s[k] ? 'on' : ''}" data-act="toggle" data-k="${k}"></button></div>`;
  render('settings', `<div class="top"><button class="iconbtn" data-act="settingsBack">${ico('back')}</button><h2>Settings</h2></div><div class="scroll">${tg('sfx', 'Sound effects')}${tg('music', 'Music')}${tg('haptic', 'Vibration')}
  <div class="sect">Help</div><button class="btn wide" data-act="replayTut">Show the tutorial tips again</button>
  <div class="sect">Privacy</div><div class="col"><button class="btn wide" data-act="privacy">Privacy policy</button>${native.privacyOptionsRequired() ? `<button class="btn wide" data-act="privacyOptions">Ad privacy choices</button>` : ''}<button class="btn wide" data-act="restore">Restore purchases</button></div>
  <div class="sect">Data</div><button class="btn wide" style="color:var(--bad)" data-act="reset">Erase all progress</button>
  <p class="tiny dim center">Brewfall ${esc(native.version())}${dev ? ' · dev mode' : ''}<br>Progress is stored on this device.</p></div>`, settings.back);
}
function applySettings() { const s = P().settings; A.configure({ sfx: s.sfx, music: s.music }); hapticOn = s.haptic; }
let hapticOn = true; const rawHaptic = native.haptic; native.haptic = ms => { if (hapticOn) rawHaptic(ms); };

// ---------- actions ----------
const act = {
  home, setup, codex, settings, dailyReward, pause,
  store: d => storeScreen(d.tab), missions: d => missionsScreen(d.tab),
  settingsBack: () => settings.back(),
  continue: () => { const p = P(); try { run = new Run({ restore: JSON.parse(JSON.stringify(p.run)) }); if (run.phase === 'shop') shop(); else if (run.phase === 'round') game(); else { run = null; p.run = null; S.save(); home(); } } catch (e) { console.error(e); p.run = null; run = null; S.save(true); toast('That run could not be restored.'); home(); } },
  daily: () => { if (P().run) return confirmDlg('Start the Daily Brew?', 'Your saved run will be abandoned.', 'Start', () => startRun('daily')); startRun('daily'); },
  start: () => { if (P().run) return confirmDlg('Start a new run?', 'Your saved run will be abandoned.', 'Start', () => startRun('run')); startRun('run'); },
  pickFam: d => { P().equip.familiar = d.id; S.save(); setup(); }, pickStake: d => { P().equip.stake = +d.i; S.save(); setup(); },
  charmInfo: d => charmInfo(+d.i, d.w), tonic: d => tonicTap(+d.i, d.w),
  buyCharm: d => buyRes(run.buyCharm(+d.i)), buyTonic: d => buyRes(run.buyTonic(+d.i)), buyRecipe: () => buyRes(run.buyRecipe()),
  reroll: () => { if (run.reroll()) { A.sfx('buy'); persistRun(); shop(); } else { A.sfx('deny'); toast('Not enough Sparks.'); } },
  adReroll: () => rewarded('reroll', () => { shop.adUsed = true; run.freeRerollByAd(); persistRun(); shop(); }),
  nextRound: () => { shop.adUsed = false; run.leaveShop(); persistRun(); game(); },
  unlock: d => { unlock(d.kind, d.id); screen === 'codex' ? codex() : storeScreen(); },
  equip: d => { P().equip[d.kind] = d.id; S.save(); storeScreen(); },
  exchange: () => { if (S.exchange()) { A.sfx('coin'); storeScreen(); } else { A.sfx('deny'); toast('Not enough Moonstones.'); } },
  adGlints: () => rewarded('glints', () => { const p = P(); if (p.adGlints.date !== S.today()) p.adGlints = { date: S.today(), n: 0 }; if (p.adGlints.n >= 5) return; p.adGlints.n++; S.earn(40); A.sfx('coin'); toast(`Earned ${G(40)}`); storeScreen(); }),
  iap: d => { if (!store.available()) return toast('Purchases are available in the Google Play version.'); toast('Opening Google Play...'); store.buy(d.sku); },
  restore: () => { toast('Checking your purchases...'); store.restore(); },
  claimMission: d => { const r = S.claimMission(+d.i); if (r) { A.sfx('coin'); toast(`Earned ${G(r.g)}${r.m ? ' ' + M(r.m) : ''}`); } else A.sfx('deny'); missionsScreen(); },
  claimAch: d => { const a = S.claimAch(d.id); if (a) { A.sfx('coin'); toast(`${a.name}: ${G(a.g)}${a.m ? ' ' + M(a.m) : ''}`); } else A.sfx('deny'); missionsScreen(); },
  toggle: d => { const s = P().settings; s[d.k] = !s[d.k]; S.save(); applySettings(); settings(settings.back); },
  replayTut: () => { P().tut = {}; S.save(); toast('Tips will show again on your next run.'); },
  privacy: () => native.openPrivacy(), privacyOptions: () => native.privacyOptions(),
  reset: () => confirmDlg('Erase everything?', 'All progress, unlocks and currency on this device will be deleted. Purchases of Remove Ads and the Founder\'s Pack can be restored afterwards; spent Moonstones cannot.', 'Erase', () => { S.wipe(); run = null; applySettings(); home(); store.restore(); }),
};
document.addEventListener('click', e => {
  A.unlock(); const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = act[el.dataset.act]; if (!fn) return; if (!['charmInfo', 'tonic'].includes(el.dataset.act)) click();
  try { fn(el.dataset, el); } catch (err) { console.error(err); toast('Something went wrong. Your progress is safe.'); }
});
document.addEventListener('pointerdown', () => A.unlock(), { once: true });

// ---------- platform events ----------
on('purchase', d => {
  const r = S.grantPurchase(d.sku, d.token), def = D.IAP_BY_SKU[d.sku];
  if (r === 'unknown') return; // not ours: leave it unconsumed
  store.finish(d.sku, d.token);
  if (r === 'granted') { A.sfx('win'); toast(`Thank you! ${def.name} delivered.`); }
  if (screen === 'store') storeScreen(); else if (screen === 'home') home();
});
on('purchaseError', d => { A.sfx('deny'); toast(esc(d.message || 'The purchase did not go through. You were not charged.')); });
on('purchasePending', () => toast('Your purchase is pending. It will be delivered as soon as Google Play confirms it.'));
on('restoreDone', d => toast(d.count ? 'Purchases restored.' : 'No purchases to restore.'));
on('products', () => { if (screen === 'store') storeScreen(); });
on('back', () => { if (modals.childElementCount) { const ov = modals.lastElementChild; if (ov.dataset.dismiss) { closeModal(ov); if (board) board.paused = false; } return; } if (screen === 'home') return native.exit(); if (screen === 'shop') return; if (backAction) backAction(); else home(); });
const goBackground = () => { persistRun(); S.save(true); A.suspend(); if (screen === 'game' && board && !board.ended) pause(); };
on('pause', goBackground); on('resume', () => A.resume());
document.addEventListener('visibilitychange', () => { if (document.hidden) goBackground(); else A.resume(); });
window.addEventListener('pagehide', () => { persistRun(); S.save(true); });
window.addEventListener('error', e => { console.error('uncaught', e.message); try { S.save(true); } catch (x) {} });

// ---------- boot ----------
const src = S.load(); applySettings(); S.missions(); home(); native.ready(); store.refresh();
if (src === 'backup' || src === 'device') toast('Your save was restored from a backup.');
if (src === 'reset') toast('Your save could not be read, so a new one was started.');
if (dev) window.__bfBoot = { S, D, act, getRun: () => run, getBoard: () => board, isNative };
