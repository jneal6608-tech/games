// Bridge to the Android shell (ads, Google Play Billing, haptics, backup). In a plain browser everything
// degrades safely: no ads, no store; with ?dev=1 ads and purchases are simulated so flows can be tested.
const B = typeof window !== 'undefined' ? window.BrewNative : null;
export const isNative = !!B;
export const dev = typeof location !== 'undefined' && /[?&]dev=1/.test(location.search);
const call = (fn, ...a) => { try { if (B && B[fn]) return B[fn](...a); } catch (e) { console.warn('native ' + fn, e); } return null; };

const listeners = {};
export const on = (ev, fn) => { (listeners[ev] ||= []).push(fn); };
const emit = (ev, data) => { for (const fn of listeners[ev] || []) { try { fn(data); } catch (e) { console.error(e); } } };
let pendingReward = null, prices = {}, pendingInter = null;

if (typeof window !== 'undefined') {
  // Native -> JS entry point. Payload is a JSON string.
  window.__brewNative = (ev, json) => {
    let d = {}; try { d = json ? JSON.parse(json) : {}; } catch (e) {}
    if (ev === 'rewarded') { const cb = pendingReward; pendingReward = null; if (cb) cb(!!d.earned, d.error || ''); }
    else if (ev === 'interstitialClosed') { const cb = pendingInter; pendingInter = null; if (cb) cb(); }
    else if (ev === 'products') { prices = d.prices || {}; emit('products', prices); }
    else emit(ev, d); // purchase, purchaseError, purchasePending, restoreDone, pause, resume, back
  };
}

export const native = {
  loadBackup() { return call('loadBackup') || ''; },
  saveBackup(s) { call('saveBackup', s); },
  haptic(ms) { if (B) call('haptic', ms); else if (typeof navigator !== 'undefined' && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } },
  ready() { call('ready'); },
  exit() { call('exitApp'); },
  openPrivacy() { if (B) call('openPrivacyPolicy'); else window.open('privacy.html', '_blank'); },
  privacyOptions() { call('showPrivacyOptions'); },
  privacyOptionsRequired() { return call('privacyOptionsRequired') === true; },
  review() { call('requestReview'); },
  version() { return call('version') || 'web'; },
};

export const ads = {
  // Can a rewarded video be offered right now?
  rewardedReady() { return B ? call('rewardedReady') === true : dev; },
  // cb(earned:boolean, error:string)
  showRewarded(placement, cb) {
    if (pendingReward) return cb(false, 'busy');
    if (B) { pendingReward = cb; if (call('showRewarded', placement) !== true) { pendingReward = null; cb(false, 'unavailable'); } return; }
    if (!dev) return cb(false, 'unavailable');
    const el = document.createElement('div'); el.className = 'fake-ad'; el.innerHTML = '<div>Test reward video<br><small>(simulated, dev mode)</small></div>'; document.body.appendChild(el);
    setTimeout(() => { el.remove(); cb(true, ''); }, 900);
  },
  showInterstitial(cb) {
    if (B) { pendingInter = cb; if (call('showInterstitial') !== true) { pendingInter = null; cb(); } return; }
    if (dev) { window.__interstitials = (window.__interstitials || 0) + 1; } cb();
  },
};

export const store = {
  available() { return isNative || dev; },
  price(sku, fallback) { return prices[sku] || fallback; },
  refresh() { call('queryProducts'); },
  // Result arrives through on('purchase' | 'purchaseError' | 'purchasePending').
  buy(sku) {
    if (B) { if (call('purchase', sku) !== true) emit('purchaseError', { sku, message: 'The store is not available right now.' }); return; }
    if (dev) { const fail = window.__failNextPurchase; window.__failNextPurchase = false; setTimeout(() => fail ? emit('purchaseError', { sku, message: 'Purchase cancelled.' }) : emit('purchase', { sku, token: window.__forceToken || ('dev-' + Date.now() + '-' + Math.random().toString(36).slice(2)) }), 300); return; }
    emit('purchaseError', { sku, message: 'Purchases are only available in the Google Play version.' });
  },
  // Tell Play the item was delivered (consume or acknowledge). Safe to call twice.
  finish(sku, token) { call('finishPurchase', sku, token); },
  restore() { if (B) call('restorePurchases'); else emit('restoreDone', { count: 0 }); },
};
