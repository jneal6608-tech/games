package com.brewfall.game

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.ViewGroup
import android.webkit.*
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import com.google.android.play.core.review.ReviewManagerFactory
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Hosts the game (bundled web assets, fully offline) and connects it to ads, billing and device features. */
class MainActivity : ComponentActivity() {
    private val origin = "https://appassets.androidplatform.net"
    private lateinit var web: WebView
    lateinit var ads: AdsManager; private set
    lateinit var billing: BillingManager; private set
    private var servicesStarted = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val root = FrameLayout(this).apply { setBackgroundColor(0xFF150F2B.toInt()) }
        web = WebView(this); root.addView(web, ViewGroup.LayoutParams(-1, -1)); setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val b = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(b.left, b.top, b.right, b.bottom); WindowInsetsCompat.CONSUMED
        }
        ads = AdsManager(this, ::emit); billing = BillingManager(this, ::emit)

        val loader = WebViewAssetLoader.Builder().addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        web.settings.apply { javaScriptEnabled = true; domStorageEnabled = true; mediaPlaybackRequiresUserGesture = false; allowFileAccess = false; allowContentAccess = false; setSupportZoom(false); textZoom = 100 }
        web.setBackgroundColor(0xFF150F2B.toInt()); web.overScrollMode = WebView.OVER_SCROLL_NEVER; web.isHapticFeedbackEnabled = false
        web.setOnLongClickListener { true }
        web.addJavascriptInterface(Bridge(this), "BrewNative")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? = loader.shouldInterceptRequest(request.url)
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.toString().startsWith(origin)) return false
                try { startActivity(Intent(Intent.ACTION_VIEW, request.url)) } catch (e: Exception) { }
                return true
            }
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean { recreate(); return true } // recover instead of crashing
        }
        web.loadUrl("$origin/assets/www/index.html") // always a fresh load: all game state lives in the save, so a recreated screen resumes cleanly
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) { override fun handleOnBackPressed() = emit("back", JSONObject()) })
    }

    /** The game has finished loading: start ads and billing now so they never delay the first frame. */
    fun onGameReady() { if (servicesStarted) { billing.syncPurchases(false); return }; servicesStarted = true; ads.start(); billing.start() }

    fun emit(event: String, data: JSONObject) {
        val js = "window.__brewNative&&window.__brewNative(${JSONObject.quote(event)},${JSONObject.quote(data.toString())})"
        runOnUiThread { if (::web.isInitialized) web.evaluateJavascript(js, null) }
    }
    fun <T> runBlockingOnUi(block: () -> T): T {
        var out: T? = null; val latch = CountDownLatch(1)
        runOnUiThread { try { out = block() } finally { latch.countDown() } }
        latch.await(3, TimeUnit.SECONDS)
        @Suppress("UNCHECKED_CAST") return (out ?: false) as T
    }
    fun vibrate(ms: Long) {
        try {
            val v = if (Build.VERSION.SDK_INT >= 31) (getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator else @Suppress("DEPRECATION") (getSystemService(VIBRATOR_SERVICE) as Vibrator)
            v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
        } catch (e: Exception) { }
    }
    fun showPrivacyPolicy() {
        val url = BuildConfig.PRIVACY_URL
        if (url.isNotBlank()) { try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))); return } catch (e: Exception) { } }
        val w = WebView(this); val loader = WebViewAssetLoader.Builder().addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        w.webViewClient = object : WebViewClient() { override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) = loader.shouldInterceptRequest(request.url) }
        w.loadUrl("$origin/assets/www/privacy.html")
        AlertDialog.Builder(this).setView(w).setPositiveButton("Close", null).show()
    }
    fun requestReview() {
        try { val m = ReviewManagerFactory.create(this); m.requestReviewFlow().addOnCompleteListener { t -> if (t.isSuccessful) m.launchReviewFlow(this, t.result) } } catch (e: Exception) { }
    }
    override fun onPause() { emit("pause", JSONObject()); web.onPause(); super.onPause() }
    override fun onResume() { super.onResume(); web.onResume(); emit("resume", JSONObject()); if (servicesStarted) billing.syncPurchases(false) }
    override fun onDestroy() { billing.destroy(); web.destroy(); super.onDestroy() }
}
