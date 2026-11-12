package com.brewfall.game

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.android.gms.ads.*
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean

/** AdMob rewarded + interstitial ads, loaded only after the consent flow (UMP) allows it. Failures never block the game. */
class AdsManager(private val activity: Activity, private val emit: (String, JSONObject) -> Unit) {
    private val tag = "BrewAds"
    private val main = Handler(Looper.getMainLooper())
    private val started = AtomicBoolean(false)
    private lateinit var consent: ConsentInformation
    @Volatile private var rewarded: RewardedAd? = null
    @Volatile private var interstitial: InterstitialAd? = null
    private var loadingR = false; private var loadingI = false; private var retry = 0

    fun start() {
        consent = UserMessagingPlatform.getConsentInformation(activity)
        val params = ConsentRequestParameters.Builder().build()
        try {
            consent.requestConsentInfoUpdate(activity, params, {
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { err -> if (err != null) Log.w(tag, "consent form: ${err.message}"); initIfAllowed() }
            }, { err -> Log.w(tag, "consent update: ${err.message}"); initIfAllowed() })
            initIfAllowed() // consent from an earlier session is still valid
        } catch (e: Exception) { Log.w(tag, "consent failed", e) }
    }
    private fun initIfAllowed() {
        if (!consent.canRequestAds() || started.getAndSet(true)) return
        Thread { try { MobileAds.initialize(activity) { main.post { loadRewarded(); loadInterstitial() } } } catch (e: Exception) { Log.w(tag, "ads init failed", e) } }.start()
    }
    fun privacyOptionsRequired() = ::consent.isInitialized && consent.privacyOptionsRequirementStatus == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
    fun showPrivacyOptions() { UserMessagingPlatform.showPrivacyOptionsForm(activity) { } }

    private fun backoff(): Long { retry = minOf(retry + 1, 6); return 5000L * (1L shl (retry - 1)) }
    private fun loadRewarded() {
        if (loadingR || rewarded != null || !started.get()) return; loadingR = true
        RewardedAd.load(activity, BuildConfig.AD_REWARDED, AdRequest.Builder().build(), object : RewardedAdLoadCallback() {
            override fun onAdLoaded(ad: RewardedAd) { loadingR = false; retry = 0; rewarded = ad }
            override fun onAdFailedToLoad(e: LoadAdError) { loadingR = false; main.postDelayed({ loadRewarded() }, backoff()) }
        })
    }
    private fun loadInterstitial() {
        if (loadingI || interstitial != null || !started.get()) return; loadingI = true
        InterstitialAd.load(activity, BuildConfig.AD_INTERSTITIAL, AdRequest.Builder().build(), object : InterstitialAdLoadCallback() {
            override fun onAdLoaded(ad: InterstitialAd) { loadingI = false; interstitial = ad }
            override fun onAdFailedToLoad(e: LoadAdError) { loadingI = false; main.postDelayed({ loadInterstitial() }, 60000) }
        })
    }
    fun rewardedReady() = rewarded != null

    /** Must run on the main thread. The reward is reported only if the video was watched to the end. */
    fun showRewarded() {
        val ad = rewarded ?: return emit("rewarded", JSONObject().put("earned", false).put("error", "unavailable"))
        rewarded = null; var earned = false
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() { emit("rewarded", JSONObject().put("earned", earned).put("error", if (earned) "" else "dismissed")); loadRewarded() }
            override fun onAdFailedToShowFullScreenContent(e: AdError) { emit("rewarded", JSONObject().put("earned", false).put("error", "failed")); loadRewarded() }
        }
        ad.show(activity) { earned = true }
    }
    fun showInterstitial() {
        val ad = interstitial ?: run { loadInterstitial(); return emit("interstitialClosed", JSONObject()) }
        interstitial = null
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() { emit("interstitialClosed", JSONObject()); loadInterstitial() }
            override fun onAdFailedToShowFullScreenContent(e: AdError) { emit("interstitialClosed", JSONObject()); loadInterstitial() }
        }
        ad.show(activity)
    }
}
