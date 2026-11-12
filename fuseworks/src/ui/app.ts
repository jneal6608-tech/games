// Game controller: owns the save, routes between screens, and turns engine results into animation.
import { Audio, Sfx } from '../audio/audio';
import { CONFIG } from '../config';
import {
  CHARMS, CHARM_BY_ID, COLOR_HEX, COLOR_NAMES, CRATES, MAX_CHARMS, NIGHTS, NIGHT_NAMES, SHELLS, SHELL_TYPES, SHOW_NAMES, SKIES,
  STAKES, STAR_INFO, WEATHER_BY_ID, targetFor, type ShellType,
} from '../engine/data';
import {
  ACHIEVEMENTS, bankRun, reconcilePurchases, checkAchievements, dayKey, defaultMeta, isUnlocked, liveStreak, migrateMeta, runTickets, unlock, unlockCost,
  type AchievementDef, type Meta, type RunReward, type UnlockKind,
} from '../engine/meta';
import { randomSeed } from '../engine/rng';
import * as G from '../engine/run';
import type { Resolution, RunState, Shell } from '../engine/types';
import { Ads, Haptic, Storage, Store, exitApp, isNative, onBackButton, onPause, openUrl, shareText } from '../platform/platform';
import { Stage, shellIcon } from '../render/stage';
import { $, bump, fmt, fmtAwe, h, wait } from './dom';

type Screen = 'title' | 'show' | 'market' | 'end' | 'workshop' | 'collection';
interface Drag { kind: 'hand' | 'board'; index: number; shell: Shell; x0: number; y0: number; active: boolean; ghost: HTMLImageElement | null; pointerId: number }
interface Ended { run: RunState; reward: RunReward; doubled: boolean; achievements: AchievementDef[] }

const K_META = 'fuseworks.meta.v1';
const K_RUN = 'fuseworks.run.v1';
/** Second copy of the progression save: if the main copy is ever unreadable, progress comes back from here. */
const K_META_BAK = 'fuseworks.meta.v1.bak';
const DRAG_LIFT = 46; // px the dragged shell floats above the finger

export class App {
  meta: Meta = defaultMeta();
  run: RunState | null = null;
  stage: Stage;
  private ui = $('#ui')!;
  private modalEl = $('#modal')!;
  private toastEl = $('#toast')!;
  screen: Screen = 'title';
  private selHand = -1;
  private selCell = -1;
  private hover = -1;
  private animating = false;
  private speed = 1;
  private shownScore = 0;
  private drag: Drag | null = null;
  private tut = -1;
  /** test hook: multiplies animation speed in automated runs */
  testSpeed = 1;
  private coinsShown: number | null = null;
  private ended: Ended | null = null;
  private price = CONFIG.premiumFallbackPrice;
  private modalClose: (() => void) | null = null;
  private workshopTab: UnlockKind = 'shell';

  constructor() {
    this.stage = new Stage($<HTMLCanvasElement>('#stage')!);
    this.bindInput();
  }

  // ================================================================ boot & persistence
  async boot(): Promise<void> {
    const readMeta = async (key: string): Promise<unknown> => { try { return JSON.parse((await Storage.get(key)) ?? 'null'); } catch { return null; } };
    const main = await readMeta(K_META);
    const usable = (o: unknown) => !!o && typeof o === 'object';
    this.meta = migrateMeta(usable(main) ? main : await readMeta(K_META_BAK));
    try {
      const raw = JSON.parse((await Storage.get(K_RUN)) ?? 'null');
      if (raw && raw.v === 1 && raw.show && Array.isArray(raw.crate)) this.run = raw as RunState;
    } catch { this.run = null; }
    this.applySettings();
    Ads.setWebHandler((p) => this.webAd(p));
    Store.setWebHandler((what) => this.webPurchase(what));
    onBackButton(() => this.back());
    onPause((paused) => { Audio.suspend(paused); if (paused) this.save(); else this.reconcile(); });
    window.addEventListener('pointerdown', () => Audio.unlock(), { passive: true });
    this.goTitle();
    // background services: never block the first frame on the network
    if (!this.meta.premium) Ads.init(); // Premium owners never load the ad SDK's ads
    Store.price().then((p) => { this.price = p; });
    this.reconcile(); // deliver purchases interrupted last time; also restores Premium
  }

  private applySettings(): void {
    const s = this.meta.settings;
    Audio.setSfx(s.sfx); Audio.setMusic(s.music); Haptic.enable(s.haptics);
    this.stage.reducedFx = s.reducedFx;
    this.stage.setSky(this.meta.sky);
  }

  /** Save and wait until it is on disk (used before telling Google a purchase is delivered). */
  async saveNow(): Promise<void> {
    const m = JSON.stringify(this.meta);
    await Storage.set(K_META, m);
    await Storage.set(K_META_BAK, m);
    if (this.run) await Storage.set(K_RUN, JSON.stringify(this.run));
  }

  private pendingPurchases = 0;
  private reconciling: Promise<void> | null = null;
  /**
   * Deliver anything Google Play says was paid for but never delivered (app killed mid-purchase, a payment
   * that cleared later, a failed consume). Safe to call any time; each purchase pays out once.
   */
  reconcile(): Promise<void> {
    if (!this.reconciling) {
      this.reconciling = (async () => {
        const owned = await Store.owned();
        if (!owned) return;
        const r = reconcilePurchases(this.meta, owned, CONFIG.ticketPacks, CONFIG.premiumProductId);
        this.pendingPurchases = r.pending;
        if (r.tickets || r.premiumGranted) {
          await this.saveNow();
          if (r.tickets) { this.toast(`🎟 ${r.tickets} tickets from your purchase have arrived. Thank you!`, 3500); Sfx.unlock(); }
          if (r.premiumGranted) this.toast('Premium is active. Thank you!', 3500);
          if (this.screen === 'title') this.goTitle(); else if (this.screen === 'workshop') this.goWorkshop();
        }
        for (const t of r.consume) await Store.finish(t, true);
        for (const t of r.acknowledge) await Store.finish(t, false);
      })().finally(() => { this.reconciling = null; });
    }
    return this.reconciling;
  }

  /** Give the reward for a purchase that just completed, save it, then mark it finished with Google. */
  private async deliver(productId: string, token: string): Promise<number> {
    const r = reconcilePurchases(this.meta, [{ productId, token, state: '1', acknowledged: false }], CONFIG.ticketPacks, CONFIG.premiumProductId);
    await this.saveNow();
    for (const t of r.consume) await Store.finish(t, true);
    for (const t of r.acknowledge) await Store.finish(t, false);
    return r.tickets;
  }

  private pendingNotice(): void {
    this.toast('Payment pending. Your purchase will arrive as soon as Google Play confirms it, even if you close the game.', 4500);
  }

  save(): void {
    const m = JSON.stringify(this.meta);
    Storage.set(K_META, m);
    Storage.set(K_META_BAK, m);
    if (this.run) Storage.set(K_RUN, JSON.stringify(this.run)); else Storage.remove(K_RUN);
  }

  // ================================================================ small UI utilities
  toast(text: string, ms = 2200): void {
    const el = h('div', null, text);
    this.toastEl.appendChild(el);
    while (this.toastEl.children.length > 3) this.toastEl.firstChild!.remove();
    setTimeout(() => el.remove(), ms);
  }

  private modal(content: HTMLElement, onClose: (() => void) | null = null): void {
    this.modalEl.replaceChildren(content);
    this.modalEl.classList.add('open');
    this.modalClose = onClose;
  }
  private closeModal(): void {
    this.modalEl.classList.remove('open');
    this.modalEl.replaceChildren();
    this.modalClose = null;
  }
  private get modalOpen(): boolean { return this.modalEl.classList.contains('open'); }

  private banner(text: string, sub = ''): void {
    const el = h('div', { class: 'banner' }, text, sub ? h('small', null, sub) : null);
    this.ui.appendChild(el);
    setTimeout(() => el.remove(), 1150);
  }

  private charmEl(id: string, big = false, onclick?: () => void): HTMLElement {
    const c = CHARM_BY_ID[id];
    return h('button', { class: `charm${big ? ' big' : ''}`, style: `--h:${c.hue}`, onclick, 'aria-label': c.name }, c.icon);
  }

  private back(): void {
    if (this.modalOpen) { if (this.modalClose) this.modalClose(); else this.closeModal(); return; }
    if (this.animating) return;
    if (this.screen === 'show' || this.screen === 'market') this.pauseMenu();
    else if (this.screen === 'title') exitApp();
    else this.goTitle();
  }

  /** Give a rewarded-ad reward. Premium players get it instantly; nobody ever sees an ad they did not ask for. */
  private async rewarded(placement: string): Promise<boolean> {
    if (this.meta.premium) return true;
    const r = await Ads.showRewarded(placement);
    if (r === 'unavailable') this.toast('No ad is available right now. Please try again in a moment.');
    return r === 'rewarded';
  }
  private adLabel(text: string): string { return this.meta.premium ? text : `▶ Watch ad: ${text}`; }

  private webAd(placement: string): Promise<'rewarded' | 'dismissed' | 'unavailable'> {
    return new Promise((resolve) => {
      let left = 3;
      const btn = h('button', { class: 'btn primary wide', disabled: true }, 'Reward in 3…');
      const tick = setInterval(() => {
        left--;
        if (left <= 0) { clearInterval(tick); btn.disabled = false; btn.textContent = 'Collect reward'; } else btn.textContent = `Reward in ${left}…`;
      }, 700);
      const done = (r: 'rewarded' | 'dismissed') => { clearInterval(tick); this.closeModal(); resolve(r); };
      btn.onclick = () => done('rewarded');
      this.modal(h('div', { class: 'sheet' },
        h('h2', null, 'Test ad'),
        h('p', { class: 'center muted' }, `Browser preview: no ad network here. In the Android app a real rewarded video plays at this point (${placement}).`),
        h('div', { class: 'stack' }, btn, h('button', { class: 'btn ghost wide', onclick: () => done('dismissed') }, 'Close without reward'))), () => done('dismissed'));
    });
  }
  private webPurchase(what = 'Fuseworks Premium'): Promise<'purchased' | 'cancelled'> {
    return new Promise((resolve) => {
      const done = (r: 'purchased' | 'cancelled') => { this.closeModal(); resolve(r); };
      this.modal(h('div', { class: 'sheet' },
        h('h2', null, 'Test purchase'),
        h('p', { class: 'center muted' }, `${what}. Browser preview: no money is charged. In the Android app this opens the Google Play purchase sheet.`),
        h('div', { class: 'stack' }, h('button', { class: 'btn gold wide', onclick: () => done('purchased') }, 'Simulate successful purchase'), h('button', { class: 'btn ghost wide', onclick: () => done('cancelled') }, 'Cancel'))), () => done('cancelled'));
    });
  }

  private announce(list: AchievementDef[]): void {
    for (const a of list) { this.toast(`🏆 ${a.name}  +${a.tickets} tickets`, 3200); Sfx.unlock(); }
  }

  // ================================================================ title
  goTitle(): void {
    this.screen = 'title';
    this.stage.view = null; this.stage.attract = true; this.stage.clearText();
    this.stage.setSky(this.meta.sky);
    const today = dayKey();
    const daily = this.meta.daily.scores[today];
    const streak = liveStreak(this.meta, today);
    const inRun = this.run && this.run.phase !== 'won' && this.run.phase !== 'lost';
    const el = h('div', { class: 'title' },
      h('div', { class: 'topbar' },
        h('button', { class: 'pill ticket buy', id: 'btn-tickets', onclick: () => this.ticketShop() }, `🎟 ${fmt(this.meta.tickets)}`, h('b', null, '+')),
        h('button', { class: 'icon-btn', onclick: () => this.settings(), 'aria-label': 'Settings' }, '⚙')),
      h('div', { class: 'logo' }, h('h1', null, 'Fuseworks'), h('p', null, 'Build the sky. Light one fuse.')),
      h('div', { class: 'menu' },
        inRun
          ? h('button', { class: 'btn primary', id: 'btn-continue', onclick: () => this.resume() }, 'Continue', h('span', { class: 'tag' }, this.run!.mode === 'daily' ? 'Daily Show' : this.run!.mode === 'endless' ? `Endless · Night ${this.run!.night}` : `Night ${this.run!.night}`))
          : null,
        h('button', { class: inRun ? 'btn' : 'btn primary', id: 'btn-new', onclick: () => this.newFestival() }, 'New Festival'),
        h('div', { class: 'row' },
          h('button', { class: 'btn two', id: 'btn-daily', onclick: () => this.dailySheet() }, 'Daily Show',
            h('span', { class: 'sub' }, `${daily ? `✓ ${fmt(daily.score)}` : 'New today'}${streak > 1 ? ` · 🔥 ${streak}` : ''}`)),
          h('button', { class: 'btn two', id: 'btn-endless-mode', onclick: () => this.newFestival('endless') }, 'Endless',
            h('span', { class: 'sub' }, this.meta.stats.bestEndless ? `Best: ${this.meta.stats.bestEndless} night${this.meta.stats.bestEndless === 1 ? '' : 's'}` : 'No final night'))),
        h('div', { class: 'row' },
          h('button', { class: 'btn', id: 'btn-workshop', onclick: () => this.goWorkshop() }, 'Workshop'),
          h('button', { class: 'btn', id: 'btn-collection', onclick: () => this.goCollection() }, 'Records')),
        this.meta.premium ? null : h('button', { class: 'btn gold', id: 'btn-premium', onclick: () => this.premiumSheet() }, '★ Go Premium')),
      h('div', { class: 'version' }, `v${CONFIG.version}${this.meta.premium ? ' · Premium' : ''}`));
    this.ui.replaceChildren(el);
  }

  private resume(): void {
    if (!this.run) return;
    if (this.run.phase === 'shop') this.goMarket(); else this.goShow();
  }

  /** Start a run. 'festival' is the six-night game; 'endless' has no final night and runs until a show fails. */
  private newFestival(mode: 'festival' | 'endless' = 'festival'): void {
    const endless = mode === 'endless';
    const start = (crateId: string, stake: number) => {
      this.closeModal();
      this.meta.crate = crateId; if (!endless) this.meta.stake = stake;
      const tutorial = !this.meta.tutorialDone;
      this.run = G.newRun({ seed: randomSeed(), mode, stake, crateId, poolShells: this.meta.shells, poolCharms: this.meta.charms, tutorial });
      this.save();
      this.goShow();
    };
    const setup = () => {
      const crates = CRATES.filter((c) => this.meta.crates.includes(c.id));
      if (crates.length === 1 && (endless || this.meta.stakeMax === 1)) return start('classic', 1);
      let crate = this.meta.crates.includes(this.meta.crate) ? this.meta.crate : 'classic';
      let stake = Math.min(this.meta.stake, this.meta.stakeMax);
      const draw = () => this.modal(h('div', { class: 'sheet' },
        h('h2', null, endless ? 'Endless play' : 'New Festival'),
        endless ? h('p', { class: 'center muted' }, 'No final night. Targets keep rising until the crowd goes home.') : null,
        h('h3', null, 'Crate'),
        crates.map((c) => h('button', { class: 'offer', onclick: () => { crate = c.id; draw(); } }, h('div', { class: 'txt' }, h('b', null, c.name), h('span', null, c.desc)), h('span', { class: `price ${c.id === crate ? '' : 'cant'}` }, c.id === crate ? '✓' : 'Pick'))),
        !endless && this.meta.stakeMax > 1 ? [h('h3', null, 'Stake'),
          STAKES.filter((s) => s.level <= this.meta.stakeMax).map((s) => h('button', { class: 'offer', onclick: () => { stake = s.level; draw(); } }, h('div', { class: 'txt' }, h('b', null, `${s.level}. ${s.name}`), h('span', null, `${s.desc} Tickets x${s.ticketMult}.`)), h('span', { class: `price ${s.level === stake ? '' : 'cant'}` }, s.level === stake ? '✓' : 'Pick')))] : null,
        h('div', { class: 'stack' }, h('button', { class: 'btn primary wide', id: 'btn-start', onclick: () => start(crate, stake) }, 'Start'), h('button', { class: 'btn ghost wide', onclick: () => this.closeModal() }, 'Cancel'))));
      draw();
    };
    if (this.run && this.run.phase !== 'won' && this.run.phase !== 'lost') {
      this.confirm('Abandon current run?', 'Your run in progress will end and its tickets will be banked.', 'Abandon and start new', () => { this.finishRun(true); setup(); });
    } else setup();
  }

  private confirm(title: string, text: string, yes: string, onYes: () => void): void {
    this.modal(h('div', { class: 'sheet' }, h('h2', null, title), h('p', { class: 'center muted' }, text),
      h('div', { class: 'stack' }, h('button', { class: 'btn primary wide', id: 'btn-yes', onclick: () => { this.closeModal(); onYes(); } }, yes), h('button', { class: 'btn ghost wide', onclick: () => this.closeModal() }, 'Cancel'))));
  }

  // ================================================================ daily show
  private dailySheet(): void {
    const today = dayKey();
    const best = this.meta.daily.scores[today];
    const th = G.dailyThresholds();
    const streak = liveStreak(this.meta, today);
    const inDaily = this.run?.mode === 'daily' && this.run.seed === `DAILY-${today}` && this.run.phase !== 'won';
    const play = () => {
      const go = () => {
        this.closeModal();
        this.run = G.newRun({ seed: `DAILY-${today}`, mode: 'daily', poolShells: defaultMeta().shells, poolCharms: defaultMeta().charms });
        this.save(); this.goShow();
      };
      if (inDaily) { this.closeModal(); this.resume(); }
      else if (this.run && this.run.phase !== 'won' && this.run.phase !== 'lost') { this.closeModal(); this.confirm('Abandon current run?', 'Starting the Daily Show ends your run in progress. Its tickets will be banked.', 'Abandon and play Daily', () => { this.finishRun(true); go(); }); }
      else go();
    };
    this.modal(h('div', { class: 'sheet' },
      h('h2', null, 'Daily Show'),
      h('p', { class: 'center muted' }, `${today} · the same sky, shells and charms for every player. Three shows, every Match counts, highest total applause wins.`),
      h('div', { class: 'medals' }, [1, 2, 3].map((m) => h('div', { class: `medal m${m}${best && best.medal >= m ? ' on' : ''}` }, h('i', null, '★'), `${fmt(th[m - 1])}`))),
      h('div', { class: 'rows' },
        h('div', null, h('span', null, 'Your best today'), h('b', null, best ? fmt(best.score) : '—')),
        h('div', null, h('span', null, 'Streak'), h('b', null, `${streak} day${streak === 1 ? '' : 's'}`)),
        h('div', null, h('span', null, 'Longest streak'), h('b', null, String(this.meta.daily.bestStreak)))),
      h('div', { class: 'stack' },
        h('button', { class: 'btn primary wide', id: 'btn-daily-play', onclick: play }, inDaily ? 'Continue' : best ? 'Play again' : 'Play'),
        best ? h('button', { class: 'btn wide', onclick: () => this.shareDaily(today) }, 'Share result') : null,
        h('button', { class: 'btn ghost wide', onclick: () => this.closeModal() }, 'Close'))));
  }

  private async shareDaily(day: string): Promise<void> {
    const s = this.meta.daily.scores[day];
    if (!s) return;
    const medal = ['', '🥉', '🥈', '🥇'][s.medal];
    const ok = await shareText('Fuseworks Daily Show', `Fuseworks Daily Show ${day}\n🎆 ${fmt(s.score)} applause ${medal}\n🔥 ${liveStreak(this.meta, day)}-day streak`);
    if (ok && !isNative && !navigator.share) this.toast('Result copied to clipboard');
  }

  // ================================================================ show screen
  goShow(): void {
    const run = this.run!;
    this.screen = 'show';
    this.stage.attract = false;
    this.selHand = -1; this.selCell = -1; this.hover = -1; this.animating = false; this.speed = 1;
    this.shownScore = run.show!.score;
    this.tut = run.tutorial && run.night === 1 && run.showIdx === 0 && run.show!.ignitions === 0 ? 0 : -1;
    this.renderShow();
    if (run.phase === 'cleared') this.clearedSheet();
    else if (run.phase === 'failed') this.failedSheet();
    else if (run.phase === 'won' || run.phase === 'lost') this.finishRun(false);
    else if (run.show!.ignitions === 0 && this.tut < 0) this.showIntro();
  }

  private showIntro(): void {
    const run = this.run!, show = run.show!;
    const w = show.weather ? WEATHER_BY_ID[show.weather] : null;
    this.banner(run.mode === 'daily' ? `Daily · Show ${run.showIdx + 1}` : `${SHOW_NAMES[run.showIdx]} Show`, w ? `${w.name}: ${w.desc}` : run.mode === 'daily' ? 'Every Match counts' : `${fmt(show.target)} applause to clear`);
  }

  private nightLabel(run: RunState): string {
    if (run.mode === 'daily') return 'Daily Show';
    if (run.mode === 'endless') return `Endless · Night ${run.night}`;
    const name = run.night <= NIGHTS ? NIGHT_NAMES[run.night - 1] : 'Endless';
    return `Night ${run.night} · ${name}`;
  }

  private renderShow(): void {
    const run = this.run!, show = run.show!;
    const w = show.weather ? WEATHER_BY_ID[show.weather] : null;
    const daily = run.mode === 'daily';
    const pct = Math.min(100, (this.shownScore / show.target) * 100);
    const hud = h('div', { class: 'hud', id: 'hud' },
      h('div', { class: 'hud-top' },
        h('button', { class: 'icon-btn', id: 'btn-menu', onclick: () => this.pauseMenu(), 'aria-label': 'Menu' }, '≡'),
        h('div', { class: 'hud-title' }, h('b', null, this.nightLabel(run)), h('span', null, daily ? `Show ${run.showIdx + 1} of 3 · total ${fmt(run.stats.totalApplause)}` : `${SHOW_NAMES[run.showIdx]} Show`)),
        h('span', { class: 'pill coin', id: 'coins' }, `◉ ${this.coinsShown ?? run.coins}`)),
      h('div', { class: 'meter' }, h('div', { class: `fill${pct >= 100 ? ' full' : ''}`, id: 'meter-fill', style: `width:${pct}%` }), h('span', { id: 'meter-text' }, `${fmt(this.shownScore)} / ${fmt(show.target)}`)),
      h('div', { class: 'scoreline', id: 'scoreline' },
        h('span', { class: 'sparkle', id: 'sl-s' }, '0'), h('small', { class: 'sparkle' }, 'Sparkle'), h('span', { class: 'x' }, '×'), h('span', { class: 'awe', id: 'sl-a' }, '1'), h('small', { class: 'awe' }, 'Awe')),
      h('div', { class: 'chips' },
        w ? h('button', { class: 'pill weather', onclick: () => this.infoSheet(`${w.icon} ${w.name}`, w.desc) }, `${w.icon} ${w.name}`) : null,
        run.charms.map((c, i) => this.charmEl(c.id, false, () => this.charmSheet(i))),
        Array.from({ length: Math.max(0, MAX_CHARMS - run.charms.length) }, () => h('span', { class: 'charm empty' }))));

    const lightReady = this.selCell >= 0 && !!show.cells[this.selCell]?.shell;
    const tray = h('div', { class: 'tray', id: 'tray' },
      h('div', { class: 'info', id: 'info', html: this.infoText() }),
      h('div', { class: 'hand', id: 'hand' },
        show.hand.length
          ? show.hand.map((s, i) => {
            const card = h('button', { class: `card${i === this.selHand ? ' sel' : ''}`, 'data-i': i },
              h('img', { src: shellIcon(s.type, s.color, run.levels[s.type] ?? 0), alt: '' }),
              h('span', { class: 'nm' }, SHELLS[s.type].name), h('span', { class: 'sp' }, s.type === 'kamuro' ? `${G.sparkleOf(run, s.type)}×#` : String(G.sparkleOf(run, s.type))));
            card.addEventListener('pointerdown', (e) => this.beginDrag('hand', i, s, e));
            return card;
          })
          : h('span', { class: 'empty' }, show.draw.length + show.discard.length ? 'Hand placed. Light the fuse to draw more shells.' : 'Your crate is empty. Light what you have built.')),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', id: 'btn-restock', disabled: show.restocksLeft <= 0 || !show.hand.length, onclick: () => this.doRestock() }, `⟳ ${show.restocksLeft}`),
        h('button', { class: 'btn', id: 'btn-crate', onclick: () => this.crateSheet() }, `▤ ${show.draw.length + show.discard.length}`),
        h('button', { class: `btn primary${lightReady ? ' ready' : ''}`, id: 'btn-light', onclick: () => this.light() }, 'Light fuse', h('span', { class: 'sub' }, `🔥×${show.matchesLeft}`))));
    this.ui.replaceChildren(hud, tray);
    this.stage.setInsets(hud.getBoundingClientRect().bottom, window.innerHeight - tray.getBoundingClientRect().top);
    this.syncView();
    this.renderCoach();
  }

  private infoText(): string {
    const run = this.run!, show = run.show!;
    if (this.selHand >= 0 && show.hand[this.selHand]) {
      const s = show.hand[this.selHand], d = SHELLS[s.type];
      return `<span><b>${COLOR_NAMES[s.color]} ${d.name}</b> · ${d.desc} Tap a cell to place it.</span>`;
    }
    if (this.selCell >= 0 && show.cells[this.selCell]?.shell) {
      const cell = show.cells[this.selCell], s = cell.shell!, res = G.resolve(run, this.selCell);
      const star = cell.star ? ` · ${STAR_INFO[cell.star].name}` : '';
      return `<span><b>${COLOR_NAMES[s.color]} ${SHELLS[s.type].name}</b>${star} · lighting here sets off <b>${res.chain}</b> burst${res.chain === 1 ? '' : 's'}${res.unlit ? `, <span class="bad">${res.unlit} left unlit</span>` : ''}.</span>`;
    }
    const placed = show.cells.some((c) => c.shell);
    return placed ? '<span>Tap a shell on the sky to choose where the fuse starts.</span>' : '<span>Drag shells from your hand onto the sky.</span>';
  }

  private syncView(): void {
    const run = this.run;
    if (!run || this.screen !== 'show') { this.stage.view = null; return; }
    const show = run.show!;
    const d = this.drag?.active ? this.drag : null;
    const hoverOk = this.hover >= 0;
    this.stage.view = {
      show, levels: run.levels,
      selected: this.animating ? -1 : this.selCell,
      preview: !this.animating && this.selCell >= 0 && show.cells[this.selCell]?.shell ? G.resolve(run, this.selCell) : null,
      placing: !this.animating && (this.selHand >= 0 || !!d),
      hover: hoverOk ? this.hover : -1,
      hoverType: d && hoverOk ? d.shell.type : null,
      hoverReach: d && hoverOk ? G.reach(show, this.hover, d.shell.type) : [],
      hint: this.tutHint(),
      dim: false,
    };
  }

  // ---------------------------------------------------------------- input
  private bindInput(): void {
    const canvas = this.stage.canvas;
    canvas.addEventListener('pointerdown', (e) => {
      if (this.screen !== 'show' || !this.run || this.modalOpen) return;
      if (this.drag) return; // another finger is already dragging: ignore extra fingers
      if (this.animating) { this.speed = 4; return; }
      if (this.run.phase !== 'show') return;
      const cell = this.stage.cellAt(e.clientX, e.clientY);
      if (cell < 0) { this.deselect(); return; }
      const c = this.run.show!.cells[cell];
      if (c.shell && !c.locked && this.selHand < 0) this.beginDrag('board', cell, c.shell, e);
      else this.tapCell(cell);
    });
    window.addEventListener('pointermove', (e) => this.moveDrag(e));
    window.addEventListener('pointerup', (e) => this.endDrag(e));
    window.addEventListener('pointercancel', (e) => { if (this.drag && e.pointerId === this.drag.pointerId) this.cancelDrag(); });
  }

  private deselect(): void {
    if (this.selHand < 0 && this.selCell < 0) return;
    this.selHand = -1; this.selCell = -1;
    this.renderShow();
  }

  private beginDrag(kind: 'hand' | 'board', index: number, shell: Shell, e: PointerEvent): void {
    if (this.animating || this.run?.phase !== 'show' || this.modalOpen || this.drag) return;
    this.drag = { kind, index, shell, x0: e.clientX, y0: e.clientY, active: false, ghost: null, pointerId: e.pointerId };
  }

  private moveDrag(e: PointerEvent): void {
    const d = this.drag;
    if (!d || !this.run || e.pointerId !== d.pointerId) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 10) return;
      d.active = true;
      d.ghost = h('img', { id: 'drag-ghost', src: shellIcon(d.shell.type, d.shell.color, this.run.levels[d.shell.type] ?? 0), alt: '' });
      document.body.appendChild(d.ghost);
      if (d.kind === 'hand') { this.selHand = -1; $(`.card[data-i="${d.index}"]`)?.classList.add('ghosted'); }
      this.selCell = -1;
      Sfx.pickup();
    }
    d.ghost!.style.left = `${e.clientX}px`;
    d.ghost!.style.top = `${e.clientY - DRAG_LIFT}px`;
    const cell = this.stage.cellAt(e.clientX, e.clientY - DRAG_LIFT);
    const ok = cell >= 0 && (G.canPlace(this.run, cell) || (d.kind === 'board' && cell === d.index));
    const next = ok ? cell : -1;
    if (next !== this.hover) { this.hover = next; if (next >= 0) Sfx.tick(); }
    this.syncView();
  }

  private endDrag(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.drag = null;
    d.ghost?.remove();
    const run = this.run;
    if (!run || run.phase !== 'show') { this.hover = -1; return; }
    if (!d.active) { // it was a tap
      if (d.kind === 'hand') {
        this.selHand = this.selHand === d.index ? -1 : d.index;
        this.selCell = -1;
        Sfx.select(); Haptic.tap();
        this.renderShow();
      } else this.tapCell(d.index);
      return;
    }
    const target = this.hover;
    this.hover = -1;
    let changed = false;
    if (d.kind === 'hand' && target >= 0) changed = G.place(run, d.index, target);
    else if (d.kind === 'board') {
      const overTray = e.clientY - DRAG_LIFT > ($('#tray')?.getBoundingClientRect().top ?? Infinity);
      if (target >= 0 && target !== d.index) changed = G.move(run, d.index, target);
      else if (overTray) changed = G.pickup(run, d.index);
    }
    if (changed) { Sfx.place(); Haptic.thud(); this.afterBoardChange(); }
    else this.renderShow();
  }

  private cancelDrag(): void {
    this.drag?.ghost?.remove();
    this.drag = null; this.hover = -1;
    if (this.screen === 'show' && this.run && !this.animating) this.renderShow();
  }

  private tapCell(cell: number): void {
    const run = this.run!, show = run.show!;
    const c = show.cells[cell];
    if (this.selHand >= 0) {
      if (G.place(run, this.selHand, cell)) { this.selHand = -1; Sfx.place(); Haptic.thud(); this.afterBoardChange(); return; }
      if (!c.shell) { Sfx.deny(); return; }
      this.selHand = -1;
    }
    if (c.shell) { this.selCell = this.selCell === cell ? -1 : cell; Sfx.select(); Haptic.tap(); }
    else this.selCell = -1;
    this.advanceTut();
    this.renderShow();
  }

  private afterBoardChange(): void {
    this.selCell = -1;
    this.advanceTut();
    this.save();
    this.renderShow();
  }

  private doRestock(): void {
    if (this.animating || !this.run) return;
    if (G.restock(this.run)) { this.selHand = -1; Sfx.restock(); Haptic.tap(); this.save(); this.renderShow(); }
  }

  // ---------------------------------------------------------------- lighting the fuse
  private light(): void {
    const run = this.run;
    if (!run || this.animating || run.phase !== 'show') return;
    const show = run.show!;
    if (!show.cells.some((c) => c.shell)) { this.toast('Place at least one shell on the sky first.'); Sfx.deny(); return; }
    if (this.selCell < 0 || !show.cells[this.selCell]?.shell) { this.toast('Tap a shell on the sky to choose where the fuse starts.'); Sfx.deny(); return; }
    if (this.tut >= 0 && this.tut < 4) this.tut = 4;
    const before = show.score;
    this.coinsShown = run.coins;
    const res = G.ignite(run, this.selCell);
    if (!res) { this.coinsShown = null; return; }
    this.save(); // the outcome is banked before the animation, so quitting mid-show cannot rewind it
    this.playChain(res, before);
  }

  private async playChain(res: Resolution, before: number): Promise<void> {
    const run = this.run!, show = run.show!;
    this.animating = true; this.speed = 1;
    this.selCell = -1; this.selHand = -1;
    this.shownScore = before;
    this.renderShow();
    $('#btn-light')!.setAttribute('disabled', '');
    const slS = $('#sl-s')!, slA = $('#sl-a')!;
    const pause = (ms: number) => wait(ms / this.speed / this.testSpeed);

    Sfx.fuse(); Haptic.tap();
    await pause(380);
    let dur = 270;
    const many = res.steps.length > 14;
    for (const st of res.steps) {
      const big = st.shell.type === 'salute' || st.shell.type === 'dragon' || st.shell.type === 'brocade';
      this.stage.burst(st.idx, st.shell, st.repeat ? [] : st.hits, dur / 1000 / this.speed, st.repeat ? 0.7 : 1);
      Sfx.burst(st.order, big);
      if (big) Haptic.boom(); else Haptic.tap();
      this.stage.pop(st.idx, `+${st.dSparkle}`, COLOR_HEX[st.shell.color], many ? 0.9 : 1);
      if (st.dAwe > (st.order > 1 ? 1 : 0)) {
        this.stage.pop(st.idx, st.notes.find((n) => n !== 'Bright Star') ?? `+${st.dAwe} Awe`, '#d7a6ff', 0.8, -this.stage.board.cell * 0.34);
        Sfx.note(st.notes.includes('Harmony') ? 'harmony' : 'charm');
      }
      slS.textContent = fmt(st.sparkleAfter); slA.textContent = fmtAwe(st.aweAfter);
      bump(slS); if (st.dAwe) bump(slA);
      await pause(dur);
      dur = Math.max(75, dur * 0.93);
    }
    await pause(260);
    let awe = res.awe;
    for (let i = 0; i < res.mults.length; i++) {
      const m = res.mults[i];
      awe = Math.round(awe * m.x * 10) / 10;
      this.banner(`×${m.x % 1 ? m.x.toFixed(1) : m.x} Awe`, m.name);
      slA.textContent = fmtAwe(i === res.mults.length - 1 ? res.finalAwe : awe); bump(slA);
      Sfx.mult(i); Haptic.thud();
      await pause(620);
    }
    // the payoff: Sparkle x Awe pours into the applause meter
    const intensity = Math.min(1, res.score / Math.max(1, show.target) + 0.15);
    this.banner(`+${fmt(res.score)}`, `${res.chain}-burst chain`);
    Sfx.cheer(intensity); Haptic.success();
    const fill = $('#meter-fill')!, text = $('#meter-text')!;
    const steps = 22;
    for (let i = 1; i <= steps; i++) {
      this.shownScore = Math.round(before + (res.score * i) / steps);
      fill.style.width = `${Math.min(100, (this.shownScore / show.target) * 100)}%`;
      fill.classList.toggle('full', this.shownScore >= show.target);
      text.textContent = `${fmt(this.shownScore)} / ${fmt(show.target)}`;
      if (i % 2 === 0) Sfx.count();
      await pause(26);
    }
    this.shownScore = show.score;
    if (res.coins) { this.toast(`Penny Sparkler: +${res.coins} coin${res.coins > 1 ? 's' : ''}`); Sfx.coin(); }
    await pause(480);
    this.animating = false; this.speed = 1; this.coinsShown = null;
    this.announce(checkAchievements(this.meta, run));
    this.save();
    if (this.tut === 4) this.tut = 5;
    if (this.screen !== 'show' || this.run !== run) return;
    this.renderShow();
    if (run.phase === 'cleared') { Sfx.clear(); this.stage.celebrate(run.mode === 'daily' ? 4 : 6); await wait(350 / this.testSpeed); if (this.run === run && this.screen === 'show') this.clearedSheet(); }
    else if (run.phase === 'failed') { Sfx.fail(); Haptic.fail(); this.failedSheet(); }
  }

  private clearedSheet(): void {
    const run = this.run!, show = run.show!, r = run.lastReward;
    const final = G.isFinalShow(run);
    const daily = run.mode === 'daily';
    const next = () => {
      this.closeModal();
      if (run.tutorial) { run.tutorial = false; this.meta.tutorialDone = true; }
      G.proceed(run);
      this.save();
      if (run.phase === 'won') this.finishRun(false); else this.goMarket();
    };
    this.modal(h('div', { class: 'sheet' },
      h('h2', null, daily ? `Show ${run.showIdx + 1} complete` : final ? 'Festival complete!' : 'Show cleared!'),
      h('div', { class: 'big gold' }, fmt(show.score)),
      h('p', { class: 'center muted' }, daily ? `Daily total so far: ${fmt(run.stats.totalApplause)}` : `applause · needed ${fmt(show.target)}`),
      r ? h('div', { class: 'rows' },
        h('div', null, h('span', null, 'Show fee'), h('b', { class: 'gold' }, `+${r.base} ◉`)),
        r.matches ? h('div', null, h('span', null, 'Unused Matches'), h('b', { class: 'gold' }, `+${r.matches} ◉`)) : null,
        r.charms ? h('div', null, h('span', null, 'Tip Jar'), h('b', { class: 'gold' }, `+${r.charms} ◉`)) : null) : null,
      h('div', { class: 'stack' },
        final && !daily
          ? [h('button', { class: 'btn primary wide', id: 'btn-next', onclick: next }, 'Take a bow'),
            h('button', { class: 'btn wide', id: 'btn-endless', onclick: () => { this.closeModal(); G.proceed(run, true); this.save(); this.goMarket(); } }, 'Keep going: Endless nights')]
          : h('button', { class: 'btn primary wide', id: 'btn-next', onclick: next }, final ? 'See results' : 'To the Market'))), null);
    this.modalClose = () => {}; // must choose
  }

  private failedSheet(): void {
    const run = this.run!, show = run.show!;
    const canEncore = !run.encoreUsed;
    this.modal(h('div', { class: 'sheet' },
      h('h2', null, 'The crowd drifts away…'),
      h('div', { class: 'big' }, `${fmt(show.score)} / ${fmt(show.target)}`),
      h('p', { class: 'center muted' }, canEncore ? 'One Encore per run: a final Match to win them back. Your whole display fires again.' : 'You have already used your Encore this run.'),
      h('div', { class: 'stack' },
        canEncore ? h('button', { class: 'btn gold wide', id: 'btn-encore', onclick: async () => {
          if (!(await this.rewarded('encore'))) { if (this.run === run && run.phase === 'failed') this.failedSheet(); return; }
          this.closeModal(); G.encore(run); this.save(); this.goShow(); this.toast('Encore! One more Match.');
        } }, this.adLabel('Encore (+1 Match)')) : null,
        h('button', { class: 'btn wide', id: 'btn-endrun', onclick: () => { this.closeModal(); G.giveUp(run); this.finishRun(false); } }, 'End the run'))), null);
    this.modalClose = () => {};
  }

  private pauseMenu(): void {
    if (this.animating) return;
    const run = this.run;
    this.modal(h('div', { class: 'sheet' },
      h('h2', null, 'Paused'),
      run ? h('p', { class: 'center muted' }, `${this.nightLabel(run)} · seed ${run.seed}`) : null,
      h('div', { class: 'stack' },
        h('button', { class: 'btn primary wide', onclick: () => this.closeModal() }, 'Resume'),
        h('button', { class: 'btn wide', onclick: () => this.howToPlay(() => this.pauseMenu()) }, 'How to play'),
        h('button', { class: 'btn wide', onclick: () => this.settings(() => this.pauseMenu()) }, 'Settings'),
        h('button', { class: 'btn wide', id: 'btn-home', onclick: () => { this.closeModal(); this.save(); this.goTitle(); } }, 'Save and exit to menu'),
        h('button', { class: 'btn ghost wide', onclick: () => this.confirm('End this run?', 'The run ends now and its tickets are banked.', 'End run', () => this.finishRun(true)) }, 'End run'))));
  }

  // ---------------------------------------------------------------- tutorial coach
  private tutHint(): number {
    if (this.tut < 0 || !this.run || this.animating) return -1;
    const cells = this.run.show!.cells;
    if (this.tut === 0) return G.cellIdx(2, 2);
    if (this.tut === 1) return [G.cellIdx(2, 3), G.cellIdx(3, 2), G.cellIdx(1, 2), G.cellIdx(2, 1)].find((i) => !cells[i].shell) ?? -1;
    return -1;
  }
  private advanceTut(): void {
    if (this.tut < 0 || !this.run) return;
    const placed = this.run.show!.cells.filter((c) => c.shell).length;
    if (this.tut === 0 && placed >= 1) this.tut = 1;
    if (this.tut === 1 && placed >= 2) this.tut = 2;
    if (this.tut === 2 && (placed >= 4 || this.selCell >= 0)) this.tut = 3;
    if (this.tut === 3 && this.selCell >= 0) this.tut = 4;
  }
  private renderCoach(): void {
    if (this.tut < 0 || this.animating || this.run?.phase !== 'show') return;
    const text = [
      'Welcome! Drag a shell from your hand onto the glowing star cell.',
      'A burst sets off every shell it reaches. Place a second shell right next to the first.',
      'Each shell shows its reach as dots. Place more so every shell is reached by another.',
      'Now tap any shell on the sky. The numbers show the order the chain will fire.',
      'Light the fuse!',
      'Sparkle × Awe = applause. Longer chains mean more Awe. Your display stays in the sky and fires again with every Match, so keep building it bigger!',
    ][this.tut];
    const tray = $('#tray')!;
    const coach = h('div', { class: `coach${this.tut === 5 ? ' tap' : ''}`, id: 'coach', style: `bottom:${window.innerHeight - tray.getBoundingClientRect().top + 8}px` }, text,
      this.tut === 5 ? h('div', null, h('button', { class: 'btn primary small', id: 'btn-coach-ok', onclick: () => { this.tut = -1; this.meta.tutorialDone = true; this.save(); this.renderShow(); } }, 'Got it')) : null);
    this.ui.appendChild(coach);
  }

  // ---------------------------------------------------------------- info sheets
  private infoSheet(title: string, text: string): void {
    this.modal(h('div', { class: 'sheet' }, h('h2', null, title), h('p', { class: 'center' }, text), h('div', { class: 'stack' }, h('button', { class: 'btn primary wide', onclick: () => this.closeModal() }, 'OK'))));
  }

  private charmSheet(index: number): void {
    const run = this.run!, inst = run.charms[index];
    if (!inst) return;
    const c = CHARM_BY_ID[inst.id];
    const extra = inst.id === 'ovation' ? ` Currently x${(1 + 0.1 * inst.counter).toFixed(1)} Awe.` : '';
    this.modal(h('div', { class: 'sheet' },
      h('div', { class: 'center' }, this.charmEl(c.id, true)),
      h('h2', null, c.name), h('p', { class: 'center' }, c.desc + extra),
      h('div', { class: 'stack' },
        h('button', { class: 'btn primary wide', onclick: () => this.closeModal() }, 'OK'),
        this.animating ? null : h('button', { class: 'btn ghost wide', id: 'btn-sell', onclick: () => { G.sellCharm(run, index); Sfx.coin(); this.closeModal(); this.save(); if (this.screen === 'market') this.goMarket(); else this.renderShow(); } }, `Sell for ${G.sellValue(c.id)} ◉`))));
  }

  private groupShells(list: Shell[]): Array<{ shell: Shell; n: number; ids: number[] }> {
    const map = new Map<string, { shell: Shell; n: number; ids: number[] }>();
    for (const s of list) {
      const k = `${s.type}|${s.color}`;
      const g = map.get(k) ?? { shell: s, n: 0, ids: [] };
      g.n++; g.ids.push(s.id); map.set(k, g);
    }
    return [...map.values()].sort((a, b) => SHELL_TYPES.indexOf(a.shell.type) - SHELL_TYPES.indexOf(b.shell.type) || a.shell.color - b.shell.color);
  }

  private crateSheet(trim = false): void {
    const run = this.run!;
    const left = run.show && run.phase !== 'shop' ? [...run.show.draw, ...run.show.discard] : run.crate;
    const leftIds = new Set(left.map((s) => s.id));
    const groups = this.groupShells(run.crate);
    const shop = run.shop;
    this.modal(h('div', { class: 'sheet' },
      h('h2', null, trim ? 'Trim a shell' : 'Your crate'),
      h('p', { class: 'center muted' }, trim ? `Remove a shell for good to draw your best ones more often. Cost ${shop!.trimCost} ◉ (you have ${run.coins}). Minimum ${G.MIN_CRATE} shells.` : `${run.crate.length} shells in total. Faded shells are on the sky or in your hand.`),
      h('div', { class: 'shellgrid' }, groups.map((g) => {
        const avail = g.ids.filter((id) => leftIds.has(id)).length;
        const lvl = run.levels[g.shell.type] ?? 0;
        return h(trim ? 'button' : 'div', { class: !trim && avail === 0 ? 'used' : '', onclick: trim ? () => {
          if (G.trim(run, g.ids[0])) { Sfx.buy(); this.save(); this.goMarket(); if (run.crate.length > G.MIN_CRATE && run.coins >= run.shop!.trimCost) this.crateSheet(true); else this.closeModal(); } else { Sfx.deny(); this.toast(run.crate.length <= G.MIN_CRATE ? 'Your crate cannot get any smaller.' : 'Not enough coins.'); }
        } : undefined },
        h('img', { src: shellIcon(g.shell.type, g.shell.color, lvl), alt: '' }), SHELLS[g.shell.type].name, h('span', { class: 'cnt' }, trim ? `×${g.n}` : `${avail}/${g.n}`));
      })),
      h('div', { class: 'stack' }, h('button', { class: 'btn primary wide', onclick: () => this.closeModal() }, 'Done'))));
  }

  // ================================================================ market (between shows)
  goMarket(): void {
    const run = this.run!, shop = run.shop!;
    this.screen = 'market';
    this.stage.view = null; this.stage.attract = true; this.stage.clearText();
    const nextIdx = (run.showIdx + 1) % 3, nextNight = run.night + (run.showIdx === 2 ? 1 : 0);
    const can = (cost: number) => run.coins >= cost;
    const buy = (ok: boolean, why = 'Not enough coins.') => { if (ok) { Sfx.buy(); Haptic.thud(); this.announce(checkAchievements(this.meta, run)); this.save(); this.goMarket(); } else { Sfx.deny(); this.toast(why); } };
    const el = h('div', { class: 'panel', id: 'market' },
      h('div', { class: 'panel-head' },
        h('button', { class: 'icon-btn', onclick: () => this.pauseMenu(), 'aria-label': 'Menu' }, '≡'),
        h('h2', null, 'Market'),
        h('span', { class: 'pill coin', id: 'coins' }, `◉ ${run.coins}`)),
      h('div', { class: 'panel-body' },
        h('div', { class: 'section' }, h('span', null, `Your charms ${run.charms.length}/${MAX_CHARMS}`), h('span', null, 'tap to inspect or sell')),
        h('div', { class: 'chips' }, run.charms.map((c, i) => this.charmEl(c.id, false, () => this.charmSheet(i))), Array.from({ length: MAX_CHARMS - run.charms.length }, () => h('span', { class: 'charm empty' }))),
        h('div', { class: 'section' }, h('span', null, 'Charms'), h('span', null, 'bend the rules for the whole run')),
        shop.charms.map((o, i) => o
          ? h('button', { class: 'offer', 'data-offer': `charm${i}`, onclick: () => buy(G.buyCharm(run, i), run.charms.length >= MAX_CHARMS ? 'You can hold 5 charms. Sell one first.' : 'Not enough coins.') },
            this.charmEl(o.id, true), h('div', { class: 'txt' }, h('b', null, CHARM_BY_ID[o.id].name), h('span', null, CHARM_BY_ID[o.id].desc)), h('span', { class: `price${can(o.cost) && run.charms.length < MAX_CHARMS ? '' : ' cant'}` }, `${o.cost} ◉`))
          : h('div', { class: 'offer sold' }, h('div', { class: 'txt' }, h('b', null, 'Sold')))),
        h('div', { class: 'section' }, h('span', null, 'Shells'), h('span', null, `crate: ${run.crate.length}`)),
        shop.packs.map((p, i) => p
          ? h('button', { class: 'offer', 'data-offer': `pack${i}`, onclick: () => { if (G.buyPack(run, i)) { Sfx.buy(); this.save(); this.goMarket(); this.packSheet(); } else { Sfx.deny(); this.toast('Not enough coins.'); } } },
            h('img', { src: shellIcon(p.shells[0].type, p.shells[0].color), alt: '' }), h('div', { class: 'txt' }, h('b', null, 'Shell pack'), h('span', null, 'Open 3 shells, keep 1 for your crate.')), h('span', { class: `price${can(p.cost) ? '' : ' cant'}` }, `${p.cost} ◉`))
          : h('div', { class: 'offer sold' }, h('div', { class: 'txt' }, h('b', null, 'Sold')))),
        shop.upgrade
          ? h('button', { class: 'offer', 'data-offer': 'upgrade', onclick: () => buy(G.buyUpgrade(run)) },
            h('img', { src: shellIcon(shop.upgrade.type, 1, (run.levels[shop.upgrade.type] ?? 0) + 1), alt: '' }),
            h('div', { class: 'txt' }, h('b', null, `Refine ${SHELLS[shop.upgrade.type].name}`), h('span', null, shop.upgrade.type === 'kamuro' ? 'Every Kamuro gains +2 Sparkle per chain place.' : `Every ${SHELLS[shop.upgrade.type].name} in your crate gains +10 Sparkle.`)),
            h('span', { class: `price${can(shop.upgrade.cost) ? '' : ' cant'}` }, `${shop.upgrade.cost} ◉`))
          : h('div', { class: 'offer sold' }, h('div', { class: 'txt' }, h('b', null, 'Refined'))),
        h('button', { class: 'offer', 'data-offer': 'trim', onclick: () => this.crateSheet(true) },
          h('div', { class: 'charm big empty' }, '✂'), h('div', { class: 'txt' }, h('b', null, 'Trim the crate'), h('span', null, 'Remove a shell so you draw your best more often.')), h('span', { class: `price${can(shop.trimCost) && run.crate.length > G.MIN_CRATE ? '' : ' cant'}` }, `${shop.trimCost} ◉`)),
        h('div', { class: 'section' }, h('span', null, 'Not what you need?')),
        h('div', { style: 'display:flex;gap:8px' },
          h('button', { class: 'btn small', id: 'btn-reroll', style: 'flex:1', disabled: !can(G.rerollCost(run)), onclick: () => { if (G.reroll(run)) { Sfx.restock(); this.save(); this.goMarket(); } } }, `⟳ Reroll · ${G.rerollCost(run)} ◉`),
          shop.freeRerollUsed ? null : h('button', { class: 'btn small gold', id: 'btn-free-reroll', style: 'flex:1', onclick: async () => { if (await this.rewarded('reroll')) { if (G.reroll(run, true)) { Sfx.restock(); this.save(); } } if (this.screen === 'market') this.goMarket(); } }, this.adLabel('Free reroll')))),
      h('div', { class: 'panel-foot' },
        h('p', { class: 'muted', style: 'margin:0 0 8px;text-align:center;font-size:13px' }, run.mode === 'daily' ? `Next: Show ${run.showIdx + 2} of 3` : `Next: Night ${nextNight} ${SHOW_NAMES[nextIdx]} · ${fmt(targetFor(nextNight, nextIdx, run.stake))} applause`),
        h('button', { class: 'btn primary wide', id: 'btn-next-show', onclick: () => { G.leaveShop(run); this.save(); this.goShow(); } }, 'Next show')));
    this.ui.replaceChildren(el);
    if (shop.pending) this.packSheet();
  }

  private packSheet(): void {
    const run = this.run!, pend = run.shop?.pending;
    if (!pend) return;
    const pick = (i: number) => { G.choosePack(run, i); if (i >= 0) Sfx.unlock(); this.closeModal(); this.save(); this.goMarket(); };
    this.modal(h('div', { class: 'sheet' },
      h('h2', null, 'Keep one shell'),
      h('div', { class: 'pick3' }, pend.map((s, i) => h('button', { 'data-pick': i, onclick: () => pick(i) },
        h('img', { src: shellIcon(s.type, s.color, run.levels[s.type] ?? 0, 128), alt: '' }), `${COLOR_NAMES[s.color]} ${SHELLS[s.type].name}`, h('span', null, SHELLS[s.type].desc)))),
      h('div', { class: 'stack' }, h('button', { class: 'btn ghost wide', onclick: () => pick(-1) }, 'Keep none'))), null);
    this.modalClose = () => {};
  }

  // ================================================================ end of run
  /** Bank the run into the permanent save exactly once, then show the results. */
  private finishRun(abandoned: boolean): void {
    const run = this.run;
    if (!run) return;
    if (run.phase !== 'won') run.phase = 'lost';
    const reward = bankRun(this.meta, run, dayKey());
    const achievements = checkAchievements(this.meta, run);
    let doubled = false;
    if (this.meta.premium && reward.tickets > 0) { this.meta.tickets += reward.tickets; this.meta.stats.tickets += reward.tickets; doubled = true; }
    this.run = null;
    this.ended = { run, reward, doubled, achievements };
    this.save();
    this.closeModal();
    if (abandoned) { this.announce(achievements); if (reward.tickets) this.toast(`Run banked: +${reward.tickets * (doubled ? 2 : 1)} tickets`); this.goTitle(); return; }
    this.goEnd();
  }

  private goEnd(): void {
    const e = this.ended;
    if (!e) return this.goTitle();
    const { run, reward } = e;
    this.screen = 'end';
    this.stage.view = null; this.stage.attract = true; this.stage.clearText();
    const daily = run.mode === 'daily';
    const endlessRun = run.mode === 'endless';
    const won = reward.won;
    if (won || reward.endlessBest) { Sfx.clear(); this.stage.celebrate(10); }
    const th = G.dailyThresholds();
    const el = h('div', { class: 'panel' },
      h('div', { class: 'panel-body' },
        h('h2', { style: 'text-align:center;font-size:28px;margin:18px 0 4px' }, daily ? 'Daily Show complete' : won ? 'Grand Festival complete!' : endlessRun ? 'Endless run over' : 'Run over'),
        h('p', { class: 'muted', style: 'text-align:center;margin:0 0 10px' }, daily ? run.seed.replace('DAILY-', '') : won ? `Stake ${run.stake} · ${STAKES[run.stake - 1].name}` : `You reached Night ${run.night}, ${SHOW_NAMES[run.showIdx]} Show`),
        daily ? [h('div', { class: 'sheet-big', style: 'text-align:center;font-size:38px;font-weight:900;color:var(--gold)' }, fmt(run.stats.totalApplause)),
          h('div', { class: 'medals' }, [1, 2, 3].map((m) => h('div', { class: `medal m${m}${reward.medal >= m ? ' on' : ''}` }, h('i', null, '★'), fmt(th[m - 1])))),
          reward.dailyBest ? h('p', { class: 'ok', style: 'text-align:center' }, 'New best for today!') : null] : null,
        reward.endlessBest ? h('p', { class: 'ok', style: 'text-align:center' }, `New Endless record: ${run.stats.nightsCleared} night${run.stats.nightsCleared === 1 ? '' : 's'} completed!`) : null,
        h('div', { class: 'statgrid' },
          h('div', null, h('b', null, fmt(run.stats.bestIgnition)), h('span', null, 'Best single Match')),
          h('div', null, h('b', null, String(run.stats.bestChain)), h('span', null, 'Longest chain')),
          h('div', null, h('b', null, String(run.stats.showsCleared)), h('span', null, 'Shows cleared')),
          h('div', null, h('b', null, fmt(run.stats.shellsBurst)), h('span', null, 'Shells burst'))),
        h('div', { class: 'section' }, h('span', null, 'Tickets earned')),
        h('div', { class: 'rows' }, reward.parts.map((p) => h('div', null, h('span', null, p.label), h('b', null, `+${p.n} 🎟`))),
          reward.parts.length ? null : h('div', null, h('span', { class: 'muted' }, 'Already rewarded today'), h('b', null, '—')),
          e.doubled ? h('div', null, h('span', { class: 'gold' }, this.meta.premium ? 'Premium: doubled' : 'Doubled'), h('b', { class: 'gold' }, `+${reward.tickets} 🎟`)) : null),
        !e.doubled && reward.tickets > 0 ? h('button', { class: 'btn gold wide', id: 'btn-double', onclick: async () => {
          if (await this.rewarded('double_tickets')) { this.meta.tickets += reward.tickets; this.meta.stats.tickets += reward.tickets; e.doubled = true; Sfx.unlock(); this.save(); }
          if (this.screen === 'end') this.goEnd();
        } }, this.adLabel(`Double tickets (+${reward.tickets})`)) : null,
        reward.newStake ? h('p', { class: 'ok', style: 'text-align:center' }, `New stake unlocked: ${STAKES[reward.newStake - 1].name}`) : null,
        e.achievements.length ? [h('div', { class: 'section' }, h('span', null, 'Achievements')), e.achievements.map((a) => h('div', { class: 'ach done' }, h('div', { class: 'mark' }, '🏆'), h('div', null, h('b', null, a.name), h('span', null, `${a.desc} +${a.tickets} tickets`))))] : null),
      h('div', { class: 'panel-foot', style: 'display:flex;flex-direction:column;gap:8px' },
        daily ? h('button', { class: 'btn wide', onclick: () => this.shareDaily(run.seed.replace('DAILY-', '')) }, 'Share result') : null,
        h('button', { class: 'btn primary wide', id: 'btn-again', onclick: () => { this.ended = null; if (daily) this.goTitle(); else this.newFestival(endlessRun ? 'endless' : 'festival'); } }, daily ? 'Done' : endlessRun ? 'Play Endless again' : 'New Festival'),
        daily ? null : h('button', { class: 'btn wide', id: 'btn-end-home', onclick: () => { this.ended = null; this.goTitle(); } }, 'Main menu')));
    this.ui.replaceChildren(el);
    e.achievements.length && Sfx.unlock();
  }

  // ================================================================ workshop (permanent unlocks)
  goWorkshop(): void {
    this.screen = 'workshop';
    this.stage.view = null; this.stage.attract = true;
    const tab = this.workshopTab;
    const items: Array<{ id: string; name: string; desc: string; icon: HTMLElement; premium?: boolean }> =
      tab === 'shell' ? SHELL_TYPES.map((t) => ({ id: t, name: SHELLS[t].name, desc: `${SHELLS[t].desc} Sparkle ${t === 'kamuro' ? '4 per place' : SHELLS[t].sparkle}.`, icon: h('img', { src: shellIcon(t as ShellType, 1), alt: '' }) }))
        : tab === 'charm' ? CHARMS.map((c) => ({ id: c.id, name: c.name, desc: c.desc, icon: this.charmEl(c.id, true) }))
          : tab === 'crate' ? CRATES.map((c) => ({ id: c.id, name: c.name, desc: c.desc, icon: h('div', { class: 'charm big empty' }, '▤') }))
            : SKIES.map((s) => ({ id: s.id, name: s.name, desc: s.premium ? 'Included with Premium.' : 'A new venue for your shows.', premium: s.premium, icon: h('div', { class: 'charm big', style: `background:linear-gradient(180deg,${s.top},${s.bottom});border-color:${s.glow};box-shadow:0 0 10px ${s.glow}` }) }));
    items.sort((a, b) => unlockCost(tab, a.id) - unlockCost(tab, b.id));
    const el = h('div', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('button', { class: 'icon-btn', id: 'btn-back', onclick: () => this.goTitle(), 'aria-label': 'Back' }, '‹'), h('h2', null, 'Workshop'), h('button', { class: 'pill ticket buy', id: 'btn-tickets', onclick: () => this.ticketShop(() => this.goWorkshop()) }, `🎟 ${fmt(this.meta.tickets)}`, h('b', null, '+'))),
      h('div', { class: 'tabs' }, (['shell', 'charm', 'crate', 'sky'] as UnlockKind[]).map((k) => h('button', { class: k === tab ? 'on' : '', 'data-tab': k, onclick: () => { this.workshopTab = k; this.goWorkshop(); } }, { shell: 'Shells', charm: 'Charms', crate: 'Crates', sky: 'Skies' }[k]))),
      h('div', { class: 'panel-body' },
        h('p', { class: 'muted', style: 'font-size:13px;margin:2px 2px 10px' }, tab === 'sky' ? 'Skies are cosmetic. Tap an owned sky to use it.' : 'Earn tickets by playing. Unlocks join the Market in every future run.'),
        items.map((it) => {
          const owned = isUnlocked(this.meta, tab, it.id);
          const cost = unlockCost(tab, it.id);
          const selected = tab === 'sky' && this.meta.sky === it.id;
          const act = () => {
            if (owned) { if (tab === 'sky') { this.meta.sky = it.id; this.stage.setSky(it.id); this.save(); this.goWorkshop(); } return; }
            if (it.premium) return this.premiumSheet();
            if (unlock(this.meta, tab, it.id)) { Sfx.unlock(); Haptic.success(); this.announce(checkAchievements(this.meta, null)); this.save(); this.goWorkshop(); } else { Sfx.deny(); this.ticketShop(() => this.goWorkshop(), cost - this.meta.tickets); }
          };
          return h('button', { class: 'offer', 'data-unlock': it.id, onclick: act }, it.icon, h('div', { class: 'txt' }, h('b', null, it.name), h('span', null, it.desc)),
            owned ? h('span', { class: 'price owned' }, selected ? 'In use' : tab === 'sky' ? 'Use' : '✓')
              : it.premium ? h('span', { class: 'price' }, '★') : h('span', { class: `price ticket${this.meta.tickets >= cost ? '' : ' cant'}` }, `${cost} 🎟`));
        })));
    this.ui.replaceChildren(el);
  }

  // ================================================================ records (achievements + stats)
  goCollection(): void {
    this.screen = 'collection';
    this.stage.view = null; this.stage.attract = true;
    const s = this.meta.stats;
    const el = h('div', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('button', { class: 'icon-btn', id: 'btn-back', onclick: () => this.goTitle(), 'aria-label': 'Back' }, '‹'), h('h2', null, 'Records')),
      h('div', { class: 'panel-body' },
        h('div', { class: 'statgrid' },
          h('div', null, h('b', null, fmt(s.bestIgnition)), h('span', null, 'Best single Match')),
          h('div', null, h('b', null, String(s.bestChain)), h('span', null, 'Longest chain')),
          h('div', null, h('b', null, `${s.wins} / ${s.runs}`), h('span', null, 'Festivals won / runs')),
          h('div', null, h('b', null, `Stake ${this.meta.stakeMax}`), h('span', null, 'Highest stake unlocked')),
          h('div', null, h('b', null, s.bestEndless ? `${s.bestEndless} night${s.bestEndless === 1 ? '' : 's'}` : '—'), h('span', null, 'Endless record')),
          h('div', null, h('b', null, String(this.meta.daily.bestStreak)), h('span', null, 'Best daily streak')),
          h('div', null, h('b', null, fmt(s.shells)), h('span', null, 'Shells burst')),
          h('div', null, h('b', null, fmt(s.shows)), h('span', null, 'Shows cleared'))),
        h('div', { class: 'section' }, h('span', null, `Achievements ${Object.keys(this.meta.achievements).length}/${ACHIEVEMENTS.length}`)),
        ACHIEVEMENTS.map((a) => h('div', { class: `ach${this.meta.achievements[a.id] ? ' done' : ''}` }, h('div', { class: 'mark' }, this.meta.achievements[a.id] ? '🏆' : '·'), h('div', null, h('b', null, a.name), h('span', null, `${a.desc} +${a.tickets} tickets`))))));
    this.ui.replaceChildren(el);
  }

  // ================================================================ settings / help / premium
  private settings(backTo?: () => void): void {
    const s = this.meta.settings;
    const close = () => (backTo ? backTo() : this.closeModal());
    const toggle = (label: string, key: keyof typeof s) => h('div', { class: 'toggle' }, label,
      h('button', { class: `switch${s[key] ? ' on' : ''}`, 'data-setting': key, 'aria-label': label, onclick: () => { s[key] = !s[key]; this.applySettings(); this.save(); Sfx.tick(); this.settings(backTo); } }));
    this.modal(h('div', { class: 'sheet' },
      h('h2', null, 'Settings'),
      toggle('Music', 'music'), toggle('Sound effects', 'sfx'), toggle('Vibration', 'haptics'), toggle('Reduced effects (saves battery)', 'reducedFx'),
      h('div', { class: 'stack' },
        h('button', { class: 'btn wide', onclick: () => this.howToPlay(() => this.settings(backTo)) }, 'How to play'),
        this.meta.premium ? null : h('button', { class: 'btn wide', onclick: async () => { const o = await Store.ownsPremium(); if (o) { await this.reconcile(); this.meta.premium = true; await this.saveNow(); this.toast('Premium restored. Thank you!'); this.settings(backTo); } else this.toast(o === null ? 'Purchases can only be restored in the Android app.' : 'No Premium purchase found on this Google account.'); } }, 'Restore purchase'),
        h('button', { class: 'btn wide', onclick: () => openUrl(CONFIG.privacyPolicyUrl) }, 'Privacy policy'),
        isNative && !this.meta.premium ? h('button', { class: 'btn wide', onclick: async () => { if (!(await Ads.privacyOptions())) this.toast('No ad privacy choices are required in your region.'); } }, 'Ad privacy choices') : null,
        h('button', { class: 'btn ghost wide', onclick: () => this.confirm('Erase all progress?', 'This deletes your tickets, unlocks, records and any run in progress. A Premium purchase is kept.', 'Erase everything', () => { const premium = this.meta.premium; this.meta = defaultMeta(); this.meta.premium = premium; this.run = null; this.applySettings(); this.save(); this.goTitle(); }) }, 'Erase progress'),
        h('button', { class: 'btn primary wide', id: 'btn-settings-done', onclick: close }, 'Done')),
      h('p', { class: 'center muted', style: 'font-size:12px;margin-top:12px' }, `Fuseworks v${CONFIG.version} · ${CONFIG.supportEmail}`)), close);
  }

  private howToPlay(backTo?: () => void): void {
    const close = () => (backTo ? backTo() : this.closeModal());
    this.modal(h('div', { class: 'sheet' },
      h('h2', null, 'How to play'),
      h('p', null, h('b', null, '1. Build. '), 'Drag shells from your hand onto the sky. The dots on a shell show which cells its burst reaches.'),
      h('p', null, h('b', null, '2. Light one fuse. '), 'Tap a shell, then Light fuse. Every burst sets off the shells it reaches, and the chain runs from there.'),
      h('p', null, h('b', { class: 'sparkle' }, 'Sparkle'), ' adds up from every burst. ', h('b', { class: 'awe' }, 'Awe'), ' grows by 1 for each burst after the first. Applause = Sparkle × Awe.'),
      h('p', null, h('b', null, 'Harmony. '), 'A shell set off by a shell of the same colour gives +1 extra Awe.'),
      h('p', null, h('b', null, 'It all fires again. '), 'Your display stays in the sky. Each Match you add more shells and the whole thing goes off again, bigger.'),
      h('p', null, h('b', null, 'Star cells. '), 'Bright Star +25 Sparkle · Awe Star +2 Awe · Twin Star makes its shell burst twice.'),
      h('p', null, h('b', null, 'Modes. '), 'Festival is six nights with a grand finale. Endless has no final night: see how far you can go. The Daily Show is one sky, the same for everyone.'),
      h('p', null, h('b', null, 'Between shows '), 'spend coins at the Market on charms, new shells and refinements. Reach the applause target before you run out of Matches.'),
      h('div', { class: 'stack' }, h('button', { class: 'btn primary wide', onclick: close }, 'Got it'))), close);
  }

  /** Buy tickets with real money (consumable Google Play products). */
  private ticketShop(after?: () => void, short = 0): void {
    const packs = CONFIG.ticketPacks;
    const done = () => { this.closeModal(); if (after) after(); else if (this.screen === 'title') this.goTitle(); };
    const draw = (prices: string[]) => this.modal(h('div', { class: 'sheet' },
      h('h2', null, '🎟 Tickets'),
      h('p', { class: 'center muted' }, short > 0 ? `You need ${short} more ticket${short === 1 ? '' : 's'} for that.` : 'Unlock shells, charms, crates and skies in the Workshop.'),
      h('p', { class: 'center' }, 'You have ', h('b', null, fmt(this.meta.tickets)), ' tickets. Every run earns more for free.'),
      this.pendingPurchases ? h('p', { class: 'center gold', id: 'pending-note' }, `${this.pendingPurchases} payment${this.pendingPurchases > 1 ? 's' : ''} pending. Tickets arrive automatically once Google Play confirms.`) : null,
      h('div', { class: 'stack' }, packs.map((p, i) => h('button', { class: 'offer', 'data-pack': p.productId, onclick: async () => {
        const o = await Store.buyConsumable(p.productId, `${p.tickets} tickets`), r = o.result;
        if (r === 'purchased') {
          const got = await this.deliver(p.productId, o.token!);
          Sfx.unlock(); this.stage.celebrate(4); this.toast(`+${got || p.tickets} tickets. Thank you!`); done();
        } else if (r === 'pending') {
          this.pendingPurchases++; this.closeModal(); this.pendingNotice(); if (after) after();
        } else {
          if (r === 'unavailable') this.toast(isNative ? 'The store is not available right now. Please try again later.' : 'Purchases are available in the Android app.');
          this.ticketShop(after, short);
        }
      } }, h('div', { class: 'charm big empty' }, '🎟'),
        h('div', { class: 'txt' }, h('b', null, `${p.tickets} tickets`), h('span', null, p.tag || `about ${Math.round(p.tickets / 15)} unlocks`)),
        h('span', { class: 'price' }, prices[i])))),
      h('div', { class: 'stack' }, h('button', { class: 'btn ghost wide', id: 'btn-tickets-close', onclick: done }, 'Close'))), done);
    let shown = packs.map((p) => p.fallbackPrice);
    draw(shown);
    this.reconcile().then(() => { if (this.modalOpen && $('[data-pack]')) draw(shown); });
    Store.prices(packs.map((p) => p.productId), shown).then((pr) => { shown = pr; if (this.modalOpen && $('[data-pack]')) draw(pr); });
  }

  private premiumSheet(): void {
    this.modal(h('div', { class: 'sheet' },
      h('h2', null, '★ Fuseworks Premium'),
      h('p', { class: 'center muted' }, 'One purchase, yours forever. Fuseworks never shows an ad you did not ask for; Premium removes even those.'),
      h('div', { class: 'rows' },
        h('div', null, h('span', null, 'No ads at all'), h('b', { class: 'ok' }, '✓')),
        h('div', null, h('span', null, 'Free Encore every run'), h('b', { class: 'ok' }, '✓')),
        h('div', null, h('span', null, 'Tickets always doubled'), h('b', { class: 'ok' }, '✓')),
        h('div', null, h('span', null, 'Free Market reroll every visit'), h('b', { class: 'ok' }, '✓')),
        h('div', null, h('span', null, 'Aurora sky'), h('b', { class: 'ok' }, '✓'))),
      h('div', { class: 'stack' },
        h('button', { class: 'btn gold wide', id: 'btn-buy', onclick: async () => {
          const o = await Store.buyPremium(), r = o.result;
          if (r === 'pending') { this.closeModal(); this.pendingNotice(); return; }
          if (r === 'purchased') { await this.deliver(CONFIG.premiumProductId, o.token!); Sfx.unlock(); this.stage.celebrate(8); this.closeModal(); this.toast('Thank you! Premium is active.'); if (this.screen === 'title') this.goTitle(); if (this.screen === 'workshop') this.goWorkshop(); }
          else if (r === 'unavailable') this.toast(isNative ? 'The store is not available right now. Please try again later.' : 'Purchases are available in the Android app.');
          else if (!this.modalOpen) this.premiumSheet();
        } }, `Unlock for ${this.price}`),
        h('button', { class: 'btn ghost wide', onclick: () => this.closeModal() }, 'Not now'))));
  }
}
