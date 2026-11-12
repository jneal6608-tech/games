// Thin wrappers around device services. On Android these call Capacitor plugins; in a browser they fall back
// to web equivalents so the whole game can be played and tested without a phone.
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { CONFIG } from '../config';

export const isNative = Capacitor.isNativePlatform();

// ---------------------------------------------------------------- storage
export const Storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (isNative) return (await Preferences.get({ key })).value;
      return localStorage.getItem(key);
    } catch { return null; }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (isNative) await Preferences.set({ key, value });
      else localStorage.setItem(key, value);
    } catch { /* storage full or unavailable: the game keeps running from memory */ }
  },
  async remove(key: string): Promise<void> {
    try {
      if (isNative) await Preferences.remove({ key });
      else localStorage.removeItem(key);
    } catch { /* ignore */ }
  },
};

// ---------------------------------------------------------------- haptics
let hapticsOn = true;
export const Haptic = {
  enable(on: boolean) { hapticsOn = on; },
  tap() { if (hapticsOn && isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); },
  thud() { if (hapticsOn && isNative) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}); },
  boom() { if (hapticsOn && isNative) Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}); },
  success() { if (hapticsOn && isNative) Haptics.notification({ type: NotificationType.Success }).catch(() => {}); },
  fail() { if (hapticsOn && isNative) Haptics.notification({ type: NotificationType.Error }).catch(() => {}); },
};

// ---------------------------------------------------------------- rewarded ads
// The game never shows an ad the player did not ask for. Every call here comes from a button the player pressed.
export type AdResult = 'rewarded' | 'dismissed' | 'unavailable';
type WebAdHandler = (placement: string) => Promise<AdResult>;
let webAdHandler: WebAdHandler | null = null;
let adsReady = false;
let adLoaded = false;
let adLoading: Promise<void> | null = null;

async function preload(): Promise<void> {
  if (!isNative || !adsReady || adLoaded) return;
  if (!adLoading) {
    adLoading = AdMob.prepareRewardVideoAd({ adId: CONFIG.rewardedAdUnitId, isTesting: CONFIG.adsTestMode })
      .then(() => { adLoaded = true; })
      .catch(() => { adLoaded = false; })
      .finally(() => { adLoading = null; });
  }
  await adLoading;
}

export const Ads = {
  /** The browser build has no ad network; the UI supplies a clearly-labelled stand-in so reward flows can be tested. */
  setWebHandler(h: WebAdHandler) { webAdHandler = h; },

  async init(): Promise<void> {
    if (!isNative) return;
    try {
      await AdMob.initialize({ initializeForTesting: CONFIG.adsTestMode });
      // Google's consent flow (required in the EEA/UK). Shows a form only where the law requires one.
      try {
        const info = await AdMob.requestConsentInfo();
        if (info.isConsentFormAvailable && !info.canRequestAds) await AdMob.showConsentForm();
      } catch { /* consent service unreachable: AdMob falls back to non-personalised handling */ }
      adsReady = true;
      preload();
    } catch { adsReady = false; }
  },

  async showRewarded(placement: string): Promise<AdResult> {
    if (!isNative) return webAdHandler ? webAdHandler(placement) : 'unavailable';
    if (!adsReady) return 'unavailable';
    await preload();
    if (!adLoaded) return 'unavailable';
    let rewarded = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    try {
      handles.push(await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { rewarded = true; }));
      await new Promise<void>((resolve) => {
        // showRewardVideoAd() only settles when a reward is earned, so closing early is caught by Dismissed.
        Promise.all([
          AdMob.addListener(RewardAdPluginEvents.Dismissed, () => resolve()),
          AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => resolve()),
        ]).then((hs) => {
          handles.push(...hs);
          AdMob.showRewardVideoAd().catch(() => resolve());
        }).catch(() => resolve());
      });
    } catch { /* treated as dismissed */ } finally {
      for (const h of handles) h.remove().catch(() => {});
      adLoaded = false;
      preload();
    }
    return rewarded ? 'rewarded' : 'dismissed';
  },

  async privacyOptions(): Promise<boolean> {
    if (!isNative) return false;
    try { await AdMob.showPrivacyOptionsForm(); return true; } catch { return false; }
  },
};

// ---------------------------------------------------------------- Google Play purchases
// The plugin is configured with autoFinishTransactions: false, so nothing is consumed or acknowledged until the
// game has saved the reward. Then the game calls finish(). Purchases interrupted at any point are picked up by
// owned(), which the app checks at launch, on resume and when the ticket shop opens.
export type PurchaseResult = 'purchased' | 'cancelled' | 'pending' | 'unavailable';
export interface PurchaseOutcome { result: PurchaseResult; token?: string }
type WebPurchaseHandler = (what: string) => Promise<'purchased' | 'cancelled'>;
let webPurchaseHandler: WebPurchaseHandler | null = null;
/**
 * Simulated purchases exist only for development and the automated tests (local server or ?dev=1). A browser build
 * hosted anywhere else reports the store as unavailable, so a public web preview can never hand out paid content.
 */
const SIMULATED_STORE = typeof location !== 'undefined'
  && (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || /[?&]dev=1/.test(location.search));

async function buy(productId: string, label: string, isConsumable: boolean): Promise<PurchaseOutcome> {
  if (!isNative) {
    if (!webPurchaseHandler || !SIMULATED_STORE) return { result: 'unavailable' };
    const r = await webPurchaseHandler(label);
    return r === 'purchased' ? { result: r, token: `web-${Date.now()}-${Math.random().toString(36).slice(2)}` } : { result: r };
  }
  try {
    const ok = await NativePurchases.isBillingSupported();
    if (!ok.isBillingSupported) return { result: 'unavailable' };
    const t = await NativePurchases.purchaseProduct({ productIdentifier: productId, productType: PURCHASE_TYPE.INAPP, quantity: 1, isConsumable, autoAcknowledgePurchases: false });
    if (!t || t.productIdentifier !== productId) return { result: 'cancelled' };
    if (t.purchaseState && t.purchaseState !== '1') return { result: 'pending' };
    return { result: 'purchased', token: t.purchaseToken ?? t.transactionId };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).toLowerCase();
    if (msg.includes('pending')) return { result: 'pending' };
    if (msg.includes('already') && msg.includes('own')) return { result: 'pending' }; // an unfinished earlier purchase: recovery delivers it
    return { result: msg.includes('cancel') ? 'cancelled' : 'unavailable' };
  }
}

export const Store = {
  setWebHandler(h: WebPurchaseHandler) { webPurchaseHandler = h; },

  async price(): Promise<string> {
    if (!isNative) return CONFIG.premiumFallbackPrice;
    try {
      const { product } = await NativePurchases.getProduct({ productIdentifier: CONFIG.premiumProductId, productType: PURCHASE_TYPE.INAPP });
      return product.priceString || CONFIG.premiumFallbackPrice;
    } catch { return CONFIG.premiumFallbackPrice; }
  },

  /** Localised prices for several products; missing ones fall back to the given defaults. */
  async prices(ids: string[], fallback: string[]): Promise<string[]> {
    if (!isNative) return fallback;
    try {
      const { products } = await NativePurchases.getProducts({ productIdentifiers: ids, productType: PURCHASE_TYPE.INAPP });
      return ids.map((id, i) => products.find((p) => p.identifier === id)?.priceString || fallback[i]);
    } catch { return fallback; }
  },

  buyPremium: () => buy(CONFIG.premiumProductId, 'Fuseworks Premium', false),
  buyConsumable: (productId: string, label: string) => buy(productId, label, true),

  /** Tell Google the reward has been delivered. Call only AFTER the save that records it. */
  async finish(token: string, consumable: boolean): Promise<boolean> {
    if (!isNative) return true;
    try {
      if (consumable) await NativePurchases.consumePurchase({ purchaseToken: token });
      else await NativePurchases.acknowledgePurchase({ purchaseToken: token });
      return true;
    } catch { return false; }
  },

  /** Every in-app purchase Google says this account currently holds (unconsumed packs, Premium, pending ones). null = could not ask. */
  async owned(): Promise<Array<{ productId: string; token: string; state: string; acknowledged: boolean }> | null> {
    if (!isNative) return null;
    try {
      const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
      return purchases.map((p) => ({ productId: p.productIdentifier, token: p.purchaseToken ?? p.transactionId, state: p.purchaseState ?? '1', acknowledged: p.isAcknowledged ?? true }));
    } catch { return null; }
  },

  /** For "Restore purchase": ask Google to resync, then report whether Premium is owned. */
  async ownsPremium(): Promise<boolean | null> {
    if (!isNative) return null;
    try { await NativePurchases.restorePurchases(); } catch { /* fall through to the query */ }
    const list = await Store.owned();
    return list === null ? null : list.some((p) => p.productId === CONFIG.premiumProductId && p.state === '1');
  },
};

// ---------------------------------------------------------------- misc
export async function shareText(title: string, text: string): Promise<boolean> {
  try {
    if (isNative) { await Share.share({ title, text, dialogTitle: title }); return true; }
    if (navigator.share) { await navigator.share({ title, text }); return true; }
    await navigator.clipboard.writeText(text);
    return true;
  } catch { return false; }
}

export function onBackButton(handler: () => void): void {
  if (isNative) App.addListener('backButton', handler);
  else window.addEventListener('keydown', (e) => { if (e.key === 'Escape') handler(); });
}
export function onPause(handler: (paused: boolean) => void): void {
  document.addEventListener('visibilitychange', () => handler(document.hidden));
  if (isNative) {
    App.addListener('pause', () => handler(true));
    App.addListener('resume', () => handler(false));
  }
}
export function exitApp(): void { if (isNative) App.exitApp(); }
export function openUrl(url: string): void { window.open(url, '_blank'); }
