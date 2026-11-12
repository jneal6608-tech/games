package com.emberhold.game;

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

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Google Play Billing for one-time products. Product ids must match web/js/data.js (EH.PRODUCTS)
 * and the in-app products created in Play Console.
 */
final class Billing implements PurchasesUpdatedListener {
    private static final List<String> PERMANENT = Arrays.asList("keeper_pack", "starter_pack");
    private static final List<String> CONSUMABLE = Arrays.asList("gems_1", "gems_2", "gems_3", "gems_4");

    private final MainActivity host;
    private final BillingClient client;
    private final Map<String, ProductDetails> details = new HashMap<>();
    private final Set<String> handled = new HashSet<>();   // purchase tokens already delivered this session
    private String pendingReq, pendingSku;
    private boolean connecting;

    Billing(MainActivity host) {
        this.host = host;
        client = BillingClient.newBuilder(host)
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
        connect(null);
    }

    private void connect(final Runnable then) {
        if (client.isReady()) { if (then != null) then.run(); return; }
        if (connecting) return;
        connecting = true;
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult r) {
                connecting = false;
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
                queryProducts();
                queryOwned();
                if (then != null) host.runOnUiThread(then);
            }

            @Override
            public void onBillingServiceDisconnected() { connecting = false; }
        });
    }

    private void queryProducts() {
        List<QueryProductDetailsParams.Product> list = new ArrayList<>();
        List<String> all = new ArrayList<>(PERMANENT);
        all.addAll(CONSUMABLE);
        for (String id : all) {
            list.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
        }
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(), (r, result) -> {
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
            host.runOnUiThread(() -> {
                for (ProductDetails d : result.getProductDetailsList()) details.put(d.getProductId(), d);
                sendPrices();
            });
        });
    }

    /** Pushes localised prices to the shop screen. */
    void sendPrices() {
        if (details.isEmpty()) return;
        try {
            JSONObject o = new JSONObject();
            for (ProductDetails d : details.values()) {
                ProductDetails.OneTimePurchaseOfferDetails offer = d.getOneTimePurchaseOfferDetails();
                if (offer != null) o.put(d.getProductId(), offer.getFormattedPrice());
            }
            host.js("EH.Native.onPrices(" + o + ")");
        } catch (Exception ignored) { }
    }

    /** Re-delivers owned permanent products and finishes any purchase that was interrupted. */
    void refresh() {
        if (!client.isReady()) { connect(null); return; }
        queryOwned();
    }

    private void queryOwned() {
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (r, purchases) -> {
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
            host.runOnUiThread(() -> { for (Purchase p : purchases) deliver(p, false); });
        });
    }

    void purchase(final String reqId, final String sku) {
        if (!client.isReady()) {
            connect(() -> purchase(reqId, sku));
            if (!client.isReady() && !connecting) result(reqId, sku, false, "The store is not available right now.");
            else if (connecting) { /* continues in the callback above, or times out silently */ }
            return;
        }
        ProductDetails d = details.get(sku);
        if (d == null) { queryProducts(); result(reqId, sku, false, "This item is not available yet. Please try again."); return; }
        pendingReq = reqId;
        pendingSku = sku;
        BillingFlowParams params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(
                        BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d).build()))
                .build();
        BillingResult r = client.launchBillingFlow(host, params);
        if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            pendingReq = null;
            result(reqId, sku, false, r.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED ? "You already own this." : "Purchase could not start.");
            if (r.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) queryOwned();
        }
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult r, List<Purchase> purchases) {
        final int code = r.getResponseCode();
        host.runOnUiThread(() -> {
            if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
                for (Purchase p : purchases) deliver(p, true);
            } else if (pendingReq != null) {
                String msg = code == BillingClient.BillingResponseCode.USER_CANCELED ? "" : "Purchase was not completed.";
                result(pendingReq, pendingSku, false, msg);
                pendingReq = null;
                if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) queryOwned();
            }
        });
    }

    private void deliver(final Purchase p, final boolean fresh) {
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) {
            if (fresh && pendingReq != null) { result(pendingReq, pendingSku, false, "Your purchase is pending and will arrive once payment clears."); pendingReq = null; }
            return;
        }
        for (final String sku : p.getProducts()) {
            if (CONSUMABLE.contains(sku)) {
                if (!handled.add(p.getPurchaseToken())) continue;
                client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), (cr, token) -> host.runOnUiThread(() -> {
                    if (cr.getResponseCode() == BillingClient.BillingResponseCode.OK) granted(sku);
                    else handled.remove(p.getPurchaseToken());
                }));
            } else if (PERMANENT.contains(sku)) {
                if (!p.isAcknowledged()) {
                    client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), ar -> { });
                }
                if (pendingReq != null && sku.equals(pendingSku)) granted(sku);
                else host.js("EH.Native.onOwned(" + MainActivity.q(sku) + ")");
            }
        }
    }

    /** Tells the game to grant a product: answers the waiting request if there is one, otherwise delivers it unprompted. */
    private void granted(String sku) {
        String req = (pendingReq != null && sku.equals(pendingSku)) ? pendingReq : "";
        if (!req.isEmpty()) pendingReq = null;
        result(req, sku, true, "");
    }

    private void result(String reqId, String sku, boolean ok, String msg) {
        host.js("EH.Native.onPurchase(" + MainActivity.q(reqId) + "," + MainActivity.q(sku) + "," + ok + "," + MainActivity.q(msg) + ")");
    }

    void close() { try { client.endConnection(); } catch (Exception ignored) { } }
}
