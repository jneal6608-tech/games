package com.catangle.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Thin native shell. The whole game is the web app in assets/ (shared with the browser build);
 * this class hosts it in a WebView and bridges ads, purchases, haptics and the back button.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/index.html";

    private WebView web;
    private AdsManager ads;
    private BillingManager billing;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        int bg = Color.parseColor("#FFE9CF");
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(bg);
        web = new WebView(this);
        web.setBackgroundColor(bg);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        // Android 15+ draws edge to edge: keep the game clear of system bars and cutouts.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                v.setPadding(i.left, i.top, i.right, i.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
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
                if (HOST.equals(u.getHost())) return false;
                openExternal(u.toString()); // the game page never navigates away, so the bridge stays private
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        ads = new AdsManager(this);
        billing = new BillingManager(this, this::event);

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::jsBack);
        }
        if (savedInstanceState == null) web.loadUrl(START);
        else web.restoreState(savedInstanceState);
    }

    private void jsBack() {
        web.evaluateJavascript("window.__back ? (window.__back(), true) : false", v -> {
            if (!"true".equals(v)) moveTaskToBack(true);
        });
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() { jsBack(); }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() { web.onPause(); super.onPause(); }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        if (billing != null) billing.refreshPurchases();
    }

    @Override
    protected void onDestroy() {
        if (billing != null) billing.destroy();
        web.destroy();
        super.onDestroy();
    }

    private void openExternal(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
    }

    private void result(int id, JSONObject data) {
        web.evaluateJavascript("window.__nativeResult(" + id + "," + JSONObject.quote(data.toString()) + ")", null);
    }

    private void event(String name, JSONObject data) {
        runOnUiThread(() -> web.evaluateJavascript(
                "window.__nativeEvent && window.__nativeEvent(" + JSONObject.quote(name) + "," + JSONObject.quote(data.toString()) + ")", null));
    }

    static JSONObject json(Object... kv) {
        JSONObject o = new JSONObject();
        try { for (int i = 0; i + 1 < kv.length; i += 2) o.put(String.valueOf(kv[i]), kv[i + 1]); } catch (JSONException ignored) { }
        return o;
    }

    /** Methods callable from the game's JavaScript (see web/js/platform.js). */
    private class Bridge {
        @JavascriptInterface
        public void call(final String method, final int id, final String argJson) {
            runOnUiThread(() -> {
                JSONObject arg;
                try { arg = new JSONObject(argJson); } catch (JSONException e) { arg = new JSONObject(); }
                switch (method) {
                    case "rewarded":
                        ads.showRewarded(outcome -> result(id, json("result", outcome)));
                        break;
                    case "interstitial":
                        ads.showInterstitial(() -> result(id, json("ok", true)));
                        break;
                    case "purchase":
                        billing.purchase(arg.optString("sku"), r -> result(id, r));
                        break;
                    case "storeInfo":
                        billing.storeInfo(r -> result(id, r));
                        break;
                    default:
                        result(id, json("ok", false, "reason", "unknown"));
                }
            });
        }

        @JavascriptInterface
        public void haptic(String kind) {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            int ms = "heavy".equals(kind) ? 28 : "medium".equals(kind) ? 14 : 7;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(ms);
        }

        @JavascriptInterface
        public void openUrl(String url) {
            if (url != null && url.startsWith("https://")) runOnUiThread(() -> openExternal(url));
        }

        @JavascriptInterface
        public void privacyOptions() { runOnUiThread(() -> ads.showPrivacyOptions()); }

        @JavascriptInterface
        public void ready() { runOnUiThread(() -> ads.start()); }

        @JavascriptInterface
        public void exit() { runOnUiThread(() -> moveTaskToBack(true)); }
    }
}
