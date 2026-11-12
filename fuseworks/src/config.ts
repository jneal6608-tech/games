// Everything you must change before a real Google Play release lives in this file
// (plus the AdMob App ID in android/app/src/main/res/values/strings.xml).
// See docs/PUBLISHING.md for the step-by-step.

export const CONFIG = {
  version: '1.0.0',

  /**
   * AdMob rewarded ad unit. The value below is Google's public TEST unit: it always fills with a test ad
   * and earns nothing. Replace with your own unit ID from the AdMob console before release.
   */
  rewardedAdUnitId: 'ca-app-pub-3940256099942544/5224354917',
  /** Keep true until your real ad unit is in place; AdMob bans accounts that click their own live ads. */
  adsTestMode: true,

  /** Google Play in-app product ID (one-time, non-consumable). Create it in Play Console with this exact ID. */
  premiumProductId: 'premium_unlock',
  /**
   * Ticket packs: consumable Google Play products (can be bought again and again).
   * Create each in Play Console with exactly these product IDs. Prices shown are fallbacks; the real price comes from Play.
   */
  ticketPacks: [
    { productId: 'tickets_60', tickets: 60, fallbackPrice: '$0.99', tag: '' },
    { productId: 'tickets_200', tickets: 200, fallbackPrice: '$2.99', tag: 'Popular' },
    { productId: 'tickets_500', tickets: 500, fallbackPrice: '$5.99', tag: 'Best value' },
  ],
  /** Shown only if the store price cannot be fetched. */
  premiumFallbackPrice: '$3.99',

  /** Host docs/privacy-policy.html somewhere public (GitHub Pages is free) and put the URL here. */
  privacyPolicyUrl: 'https://example.com/fuseworks-privacy',
  supportEmail: 'support@example.com',
};
