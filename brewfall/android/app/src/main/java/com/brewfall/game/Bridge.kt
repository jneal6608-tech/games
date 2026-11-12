package com.brewfall.game

import android.webkit.JavascriptInterface
import java.io.File

/** Methods the game (JavaScript) can call. They arrive on a background thread, so UI work is posted to the main thread. */
class Bridge(private val a: MainActivity) {
    private val saveFile get() = File(a.filesDir, "brewfall_save.json")

    @JavascriptInterface fun ready() = a.runOnUiThread { a.onGameReady() }
    @JavascriptInterface fun version(): String = BuildConfig.VERSION_NAME
    @JavascriptInterface fun loadBackup(): String = try { if (saveFile.exists()) saveFile.readText() else "" } catch (e: Exception) { "" }
    @JavascriptInterface fun saveBackup(data: String) { try { val tmp = File(a.filesDir, "brewfall_save.tmp"); tmp.writeText(data); tmp.renameTo(saveFile) } catch (e: Exception) { } }
    @JavascriptInterface fun haptic(ms: Int) = a.vibrate(ms.coerceIn(1, 60).toLong())
    @JavascriptInterface fun exitApp() = a.runOnUiThread { a.moveTaskToBack(true) }
    @JavascriptInterface fun openPrivacyPolicy() = a.runOnUiThread { a.showPrivacyPolicy() }
    @JavascriptInterface fun privacyOptionsRequired(): Boolean = a.ads.privacyOptionsRequired()
    @JavascriptInterface fun showPrivacyOptions() = a.runOnUiThread { a.ads.showPrivacyOptions() }
    @JavascriptInterface fun requestReview() = a.runOnUiThread { a.requestReview() }

    @JavascriptInterface fun rewardedReady(): Boolean = a.ads.rewardedReady()
    @JavascriptInterface fun showRewarded(placement: String): Boolean { if (!a.ads.rewardedReady()) return false; a.runOnUiThread { a.ads.showRewarded() }; return true }
    @JavascriptInterface fun showInterstitial(): Boolean { a.runOnUiThread { a.ads.showInterstitial() }; return true }

    @JavascriptInterface fun queryProducts() = a.runOnUiThread { a.billing.queryProducts() }
    @JavascriptInterface fun purchase(sku: String): Boolean = a.runBlockingOnUi { a.billing.purchase(sku) }
    @JavascriptInterface fun finishPurchase(sku: String, token: String) = a.runOnUiThread { a.billing.finish(sku, token) }
    @JavascriptInterface fun restorePurchases() = a.runOnUiThread { a.billing.syncPurchases(true) }
}
