/* Emberhold — platform layer: rewarded ads, purchases, haptics.
   Android: talks to the native bridge (AdMob + Play Billing) injected as window.AndroidBridge.
   Web: rewarded ads are simulated by a short interstitial card; purchases need ?devstore=1 (test only). */
(function (root) {
  'use strict';
  var EH = root.EH = root.EH || {};
  var bridge = root.AndroidBridge || null;
  var pending = {}, seq = 1;
  var devStore = /[?&]devstore=1/.test(root.location ? root.location.search : '');

  var P = EH.Platform = {
    mode: bridge ? 'android' : 'web',
    prices: {},
    canPurchase: function () { return !!bridge || devStore; },
    price: function (sku) { return this.prices[sku] || EH.PRODUCT[sku].price; },

    /** cb(true) when the reward should be granted. Keeper's Pack owners skip the ad entirely. */
    rewarded: function (placement, cb) {
      var S = EH.Save.data;
      if (S && S.iap.keeper) { cb(true); return; }
      if (bridge) {
        var id = 'r' + (seq++);
        pending[id] = cb;
        try { bridge.showRewarded(id, placement); }
        catch (e) { delete pending[id]; cb(false); }
        return;
      }
      EH.UI.fakeAd(cb);
    },
    purchase: function (sku, cb) {
      if (bridge) {
        var id = 'p' + (seq++);
        pending[id] = cb;
        try { bridge.purchase(id, sku); }
        catch (e) { delete pending[id]; cb(false, 'Store unavailable'); }
        return;
      }
      if (devStore) { EH.UI.confirm('TEST STORE', 'Simulate buying ' + EH.PRODUCT[sku].name + '?', function (ok) { cb(ok, ok ? '' : 'Cancelled'); }); return; }
      cb(false, 'Purchases are available in the Android app.');
    },
    restore: function () { if (bridge) { try { bridge.restorePurchases(); } catch (e) { /* ignore */ } } },
    haptic: function (ms) {
      var S = EH.Save.data;
      if (!S || !S.settings.haptics) return;
      try {
        if (bridge) bridge.haptic(ms | 0);
        else if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(ms | 0);
      } catch (e) { /* ignore */ }
    },
    openUrl: function (url) {
      try { if (bridge) bridge.openUrl(url); else root.open(url, '_blank', 'noopener'); } catch (e) { /* ignore */ }
    },
    ready: function () { if (bridge) { try { bridge.ready(); } catch (e) { /* ignore */ } } }
  };

  // ---- callbacks from native ----
  EH.Native = {
    onRewarded: function (id, ok) { var cb = pending[id]; delete pending[id]; if (cb) cb(!!ok); },
    onPurchase: function (id, sku, ok, msg) {
      var cb = pending[id]; delete pending[id];
      if (cb) cb(!!ok, msg || '');
      else if (ok && EH.Game && EH.PRODUCT[sku]) {   // a purchase that finished outside a request (pending payment, interrupted flow)
        EH.Game.grant(sku); EH.UI.toast(EH.PRODUCT[sku].name + ' delivered.'); EH.UI.refresh();
      }
    },
    onPrices: function (map) { if (map && typeof map === 'object') { P.prices = map; if (EH.UI) EH.UI.refresh(); } },
    onOwned: function (sku) { if (EH.Game) EH.Game.grantOwned(sku); },
    onPause: function () { if (EH.Game) EH.Game.appPause(); },
    onResume: function () { if (EH.Game) EH.Game.appResume(); },
    onBack: function () { return EH.UI ? EH.UI.back() : false; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
