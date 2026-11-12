package com.catangle.game;

import android.app.Activity;

import androidx.annotation.NonNull;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Google Play Billing for one entitlement (remove_ads) and three consumable fish packs.
 * Every completed purchase reaches the game as a "purchase" event carrying {sku, token};
 * the game de-duplicates by token, so a purchase delivered twice is granted once.
 */
class BillingManager implements PurchasesUpdatedListener {
    interface Callback { void done(JSONObject result); }
    interface Events { void emit(String name, JSONObject data); }

    static final String REMOVE_ADS = "remove_ads";
    private static final String[] SKUS = {REMOVE_ADS, "fish_small", "fish_medium", "fish_large"};

    private final Activity activity;
    private final Events events;
    private final BillingClient client;
    private final Map<String, ProductDetails> products = new HashMap<>();
    private final Set<String> owned = new HashSet<>();
    private final Set<String> inFlight = new HashSet<>();
    private Callback pendingPurchase;
    private boolean ready;

    BillingManager(Activity activity, Events events) {
        this.activity = activity;
        this.events = events;
        client = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(@NonNull BillingResult r) {
                ready = r.getResponseCode() == BillingClient.BillingResponseCode.OK;
                if (ready) { queryProducts(null); refreshPurchases(); }
            }
            @Override public void onBillingServiceDisconnected() { ready = false; }
        });
    }

    void destroy() { client.endConnection(); }

    private void queryProducts(final Runnable then) {
        List<QueryProductDetailsParams.Product> list = new ArrayList<>();
        for (String sku : SKUS) {
            list.add(QueryProductDetailsParams.Product.newBuilder().setProductId(sku).setProductType(BillingClient.ProductType.INAPP).build());
        }
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(), (r, result) -> {
            if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                for (ProductDetails pd : result.getProductDetailsList()) products.put(pd.getProductId(), pd);
            }
            if (then != null) activity.runOnUiThread(then);
        });
    }

    /** Picks up purchases made while the app was closed (pending payments, reinstalls). */
    void refreshPurchases() {
        if (!ready) return;
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                (r, purchases) -> {
                    if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
                    for (Purchase p : purchases) handle(p);
                });
    }

    void storeInfo(final Callback cb) {
        final Runnable reply = () -> {
            JSONObject prices = new JSONObject();
            try {
                for (Map.Entry<String, ProductDetails> e : products.entrySet()) {
                    ProductDetails.OneTimePurchaseOfferDetails o = e.getValue().getOneTimePurchaseOfferDetails();
                    if (o != null) prices.put(e.getKey(), o.getFormattedPrice());
                }
            } catch (Exception ignored) { }
            cb.done(MainActivity.json("owned", new JSONArray(owned), "prices", prices));
        };
        if (ready && products.isEmpty()) queryProducts(reply); else reply.run();
    }

    void purchase(String sku, Callback cb) {
        ProductDetails pd = products.get(sku);
        if (!ready || pd == null) { cb.done(MainActivity.json("ok", false, "reason", "unavailable")); return; }
        if (pendingPurchase != null) pendingPurchase.done(MainActivity.json("ok", false, "reason", "cancelled"));
        pendingPurchase = cb;
        BillingFlowParams params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(
                        BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd).build()))
                .build();
        BillingResult r = client.launchBillingFlow(activity, params);
        if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) finishPending("failed");
    }

    private void finishPending(String reason) {
        final Callback cb = pendingPurchase;
        pendingPurchase = null;
        if (cb != null) activity.runOnUiThread(() -> cb.done(MainActivity.json("ok", false, "reason", reason)));
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult r, List<Purchase> purchases) {
        int code = r.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) handle(p);
            finishPending("delivered"); // the grant itself arrives through the "purchase" event
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            finishPending("cancelled");
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            refreshPurchases();
            finishPending("delivered");
        } else {
            finishPending("failed");
        }
    }

    private void handle(final Purchase p) {
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return; // pending payments are granted later
        final String token = p.getPurchaseToken();
        for (final String sku : p.getProducts()) {
            if (REMOVE_ADS.equals(sku)) {
                boolean isNew = owned.add(sku);
                if (!p.isAcknowledged()) {
                    client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build(), ar -> { });
                }
                if (isNew) events.emit("purchase", MainActivity.json("sku", sku, "token", token));
            } else {
                if (!inFlight.add(token)) continue;
                client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(token).build(), (cr, t) -> {
                    inFlight.remove(token);
                    if (cr.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        events.emit("purchase", MainActivity.json("sku", sku, "token", token));
                    }
                });
            }
        }
    }
}
