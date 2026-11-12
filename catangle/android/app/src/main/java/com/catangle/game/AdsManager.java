package com.catangle.game;

import android.app.Activity;

import androidx.annotation.NonNull;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

/**
 * Google Mobile Ads with the UMP consent flow. Ads are requested only after consent allows it.
 * When no ad is ready the game is told "unavailable" and carries on; it never blocks on an ad.
 */
class AdsManager {
    interface RewardCallback { void done(String outcome); } // granted | dismissed | unavailable

    private final Activity activity;
    private ConsentInformation consent;
    private boolean started, initialized;
    private RewardedAd rewarded;
    private InterstitialAd interstitial;
    private boolean loadingRewarded, loadingInterstitial;

    AdsManager(Activity activity) { this.activity = activity; }

    /** Called once the game UI is up, so the consent form never covers a blank screen. */
    void start() {
        if (started) return;
        started = true;
        consent = UserMessagingPlatform.getConsentInformation(activity);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        consent.requestConsentInfoUpdate(activity, params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, formError -> initIfAllowed()),
                requestError -> initIfAllowed());
        initIfAllowed(); // consent from a previous session may already allow ads
    }

    private void initIfAllowed() {
        if (initialized || consent == null || !consent.canRequestAds()) return;
        initialized = true;
        new Thread(() -> MobileAds.initialize(activity, status -> activity.runOnUiThread(() -> {
            loadRewarded();
            loadInterstitial();
        }))).start();
    }

    void showPrivacyOptions() {
        UserMessagingPlatform.showPrivacyOptionsForm(activity, formError -> { });
    }

    private void loadRewarded() {
        if (!initialized || rewarded != null || loadingRewarded) return;
        loadingRewarded = true;
        RewardedAd.load(activity, BuildConfig.AD_REWARDED, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override public void onAdLoaded(@NonNull RewardedAd ad) { rewarded = ad; loadingRewarded = false; }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError error) { rewarded = null; loadingRewarded = false; }
        });
    }

    private void loadInterstitial() {
        if (!initialized || interstitial != null || loadingInterstitial) return;
        loadingInterstitial = true;
        InterstitialAd.load(activity, BuildConfig.AD_INTERSTITIAL, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
            @Override public void onAdLoaded(@NonNull InterstitialAd ad) { interstitial = ad; loadingInterstitial = false; }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError error) { interstitial = null; loadingInterstitial = false; }
        });
    }

    void showRewarded(final RewardCallback cb) {
        final RewardedAd ad = rewarded;
        if (ad == null) { loadRewarded(); cb.done("unavailable"); return; }
        rewarded = null;
        final boolean[] earned = {false};
        final boolean[] finished = {false};
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() {
                if (!finished[0]) { finished[0] = true; cb.done(earned[0] ? "granted" : "dismissed"); }
                loadRewarded();
            }
            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                if (!finished[0]) { finished[0] = true; cb.done("unavailable"); }
                loadRewarded();
            }
        });
        ad.show(activity, reward -> earned[0] = true);
    }

    void showInterstitial(final Runnable done) {
        final InterstitialAd ad = interstitial;
        if (ad == null) { loadInterstitial(); done.run(); return; }
        interstitial = null;
        final boolean[] finished = {false};
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() {
                if (!finished[0]) { finished[0] = true; done.run(); }
                loadInterstitial();
            }
            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                if (!finished[0]) { finished[0] = true; done.run(); }
                loadInterstitial();
            }
        });
        ad.show(activity);
    }
}
