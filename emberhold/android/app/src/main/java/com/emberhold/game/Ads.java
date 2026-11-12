package com.emberhold.game;

import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

/** Rewarded video only: the game never shows an ad the player did not ask for. */
final class Ads {
    private final MainActivity host;
    private RewardedAd rewarded;
    private boolean started, initialized, loading;
    private String waitingReq;      // a request that arrived while the ad was still loading

    Ads(MainActivity host) { this.host = host; }

    /** Collects consent where the law requires it (UMP), then initialises the SDK and preloads an ad. */
    void start() {
        if (started) return;
        started = true;
        final ConsentInformation info = UserMessagingPlatform.getConsentInformation(host);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        info.requestConsentInfoUpdate(host, params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(host, err -> { if (info.canRequestAds()) init(); }),
                err -> { if (info.canRequestAds()) init(); });
        if (info.canRequestAds()) init();
    }

    private void init() {
        if (initialized) return;
        initialized = true;
        new Thread(() -> MobileAds.initialize(host, status -> host.runOnUiThread(this::load))).start();
    }

    private void load() {
        if (loading || rewarded != null || !initialized) return;
        loading = true;
        RewardedAd.load(host, BuildConfig.REWARDED_UNIT, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull RewardedAd ad) {
                loading = false;
                rewarded = ad;
                if (waitingReq != null) { String r = waitingReq; waitingReq = null; show(r); }
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError error) {
                loading = false;
                rewarded = null;
                if (waitingReq != null) { fail(waitingReq); waitingReq = null; }
            }
        });
    }

    void show(final String reqId) {
        if (rewarded == null) {
            if (initialized && waitingReq == null) { waitingReq = reqId; load(); if (!loading) { waitingReq = null; fail(reqId); } }
            else fail(reqId);
            return;
        }
        final RewardedAd ad = rewarded;
        rewarded = null;
        final boolean[] earned = { false };
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                host.js("EH.Native.onRewarded(" + MainActivity.q(reqId) + "," + earned[0] + ")");
                load();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                fail(reqId);
                load();
            }
        });
        ad.show(host, item -> earned[0] = true);
    }

    private void fail(String reqId) {
        Toast.makeText(host, "No video is available right now. Please try again in a moment.", Toast.LENGTH_SHORT).show();
        host.js("EH.Native.onRewarded(" + MainActivity.q(reqId) + ",false)");
    }
}
