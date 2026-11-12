// Catangle — one seam between the game and the outside world (ads, purchases, haptics).
// On Android the native shell injects `AndroidBridge`. In a plain browser a mock stands in,
// so every flow can be tested without an ad network or a store.
const bridge = window.AndroidBridge || null;
const pending = new Map();
const listeners = new Map();
let seq = 1;
const params = new URLSearchParams(location.search);
const DEV = params.has('dev');

window.__nativeResult = (id, json) => {
  const done = pending.get(id);
  if (!done) return;
  pending.delete(id);
  let data = {};
  try { data = typeof json === 'string' ? JSON.parse(json) : json || {}; } catch (e) { /* malformed → treated as failure */ }
  done(data);
};
window.__nativeEvent = (name, json) => {
  let data = {};
  try { data = typeof json === 'string' ? JSON.parse(json) : json || {}; } catch (e) { /* ignore */ }
  (listeners.get(name) || []).forEach((fn) => fn(data));
};

function call(method, arg = {}, timeoutMs = 0) {
  return new Promise((resolve) => {
    const id = seq++;
    pending.set(id, resolve);
    try { bridge.call(method, id, JSON.stringify(arg)); }
    catch (e) { pending.delete(id); resolve({ ok: false, reason: 'bridge' }); return; }
    if (timeoutMs) setTimeout(() => { if (pending.delete(id)) resolve({ ok: false, reason: 'timeout' }); }, timeoutMs);
  });
}

function mockAd(label) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'mock-ad';
    el.innerHTML = `<div><b>${label}</b><span>Test ad placeholder · closes automatically</span></div>`;
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); resolve(); }, params.has('fastads') ? 60 : 1300);
  });
}

export const Platform = {
  isNative: !!bridge,
  dev: DEV,
  on(name, fn) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); },

  // → 'granted' | 'dismissed' | 'unavailable'
  async rewarded(placement) {
    if (bridge) { const r = await call('rewarded', { placement }); return r.result || 'unavailable'; }
    if (params.get('ads') === 'none') return 'unavailable';
    await mockAd('Rewarded video'); return 'granted';
  },
  async interstitial() {
    if (bridge) { await call('interstitial', {}, 60000); return; }
    if (params.get('ads') === 'none') return;
    await mockAd('Interstitial');
  },
  // → { ok, reason?, token? }
  async purchase(sku) {
    if (bridge) return call('purchase', { sku });
    if (DEV) return { ok: true, token: 'dev-' + Date.now() };
    return { ok: false, reason: 'unavailable' };
  },
  // → { owned: [sku], prices: {sku: '€3.49'} }
  async storeInfo() {
    if (bridge) return call('storeInfo', {}, 8000);
    return { owned: [], prices: {} };
  },
  haptic(kind) {
    if (bridge) { try { bridge.haptic(kind); } catch (e) { /* ignore */ } return; }
    if (navigator.vibrate) navigator.vibrate(kind === 'heavy' ? 28 : kind === 'medium' ? 14 : 7);
  },
  openUrl(url) { if (bridge) { try { bridge.openUrl(url); } catch (e) { /* ignore */ } } else window.open(url, '_blank', 'noopener'); },
  privacyOptions() { if (bridge) { try { bridge.privacyOptions(); } catch (e) { /* ignore */ } } },
  ready() { if (bridge) { try { bridge.ready(); } catch (e) { /* ignore */ } } },
  exit() { if (bridge) { try { bridge.exit(); } catch (e) { /* ignore */ } } },
};
