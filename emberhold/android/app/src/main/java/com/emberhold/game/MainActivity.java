package com.emberhold.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

/**
 * Hosts the game (HTML5, packaged in assets) in a WebView and exposes ads, billing and haptics to it
 * through the "AndroidBridge" JavaScript interface. See web/js/platform.js for the other half.
 */
public class MainActivity extends ComponentActivity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String START = ORIGIN + "/assets/index.html";

    private WebView web;
    private Ads ads;
    private Billing billing;
    private boolean pageReady;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(7, 6, 11));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        setContentView(web, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        hideSystemBars();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);            // the save file lives in localStorage
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);                      // the game has its own text-size setting
        s.setSupportZoom(false);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (u.toString().startsWith(ORIGIN)) return false;
                openExternal(u.toString());
                return true;
            }

            @Override
            @android.annotation.TargetApi(26)
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // The WebView renderer died (usually low memory). Start a fresh screen instead of letting the app crash;
                // all progress lives in the save, which is written on every change and on pause. A fresh start (not
                // recreate()) avoids saving the dead WebView's state.
                startActivity(new Intent(MainActivity.this, MainActivity.class));
                finish();
                return true;
            }
        });

        ads = new Ads(this);
        billing = new Billing(this);
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        if (savedInstanceState == null) web.loadUrl(START);
        else web.restoreState(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (!pageReady) { moveTaskToBack(true); return; }
                web.evaluateJavascript("(function(){try{return EH.Native.onBack()}catch(e){return false}})()", v -> {
                    if (!"true".equals(v)) moveTaskToBack(true);
                });
            }
        });
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onPause() {
        if (pageReady) js("EH.Native.onPause()");
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        if (pageReady) js("EH.Native.onResume()");
        billing.refresh();
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        billing.close();
        web.removeJavascriptInterface("AndroidBridge");
        web.destroy();
        super.onDestroy();
    }

    /** Runs a JS statement in the page, swallowing errors so native callbacks can never break the game. */
    void js(final String code) {
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript("try{" + code + "}catch(e){}", null);
        });
    }

    static String q(String s) { return JSONObject.quote(s == null ? "" : s); }

    private void openExternal(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
    }

    /** Called from JavaScript. Every method hops to the UI thread. */
    private final class Bridge {
        @JavascriptInterface
        public void ready() {
            runOnUiThread(() -> {
                pageReady = true;
                ads.start();
                billing.sendPrices();
            });
        }

        @JavascriptInterface
        public void showRewarded(final String reqId, final String placement) {
            runOnUiThread(() -> ads.show(reqId));
        }

        @JavascriptInterface
        public void purchase(final String reqId, final String sku) {
            runOnUiThread(() -> billing.purchase(reqId, sku));
        }

        @JavascriptInterface
        public void restorePurchases() {
            runOnUiThread(() -> billing.refresh());
        }

        @JavascriptInterface
        public void haptic(final int ms) {
            runOnUiThread(() -> {
                try {
                    Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                    if (v != null && v.hasVibrator()) {
                        v.vibrate(VibrationEffect.createOneShot(Math.max(1, Math.min(200, ms)), VibrationEffect.DEFAULT_AMPLITUDE));
                    }
                } catch (Exception ignored) { }
            });
        }

        @JavascriptInterface
        public boolean privacyOptionsRequired() {
            try { return ads != null && ads.privacyOptionsRequired(); } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public void showPrivacyOptions() {
            runOnUiThread(() -> ads.showPrivacyOptions());
        }

        @JavascriptInterface
        public void openUrl(final String url) {
            if (url != null && url.startsWith("https://")) runOnUiThread(() -> openExternal(url));
        }
    }

    Activity activity() { return this; }
}
