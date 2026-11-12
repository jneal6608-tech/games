package com.brewfall.game

import android.app.Activity
import android.content.Context
import android.util.Log
import com.android.billingclient.api.*
import org.json.JSONObject

/** Google Play Billing: optional one-time products only. Every purchase is signature-checked before the game is told. */
class BillingManager(private val activity: Activity, private val emit: (String, JSONObject) -> Unit) : PurchasesUpdatedListener {
    companion object {
        val CONSUMABLES = setOf("moon_80", "moon_450", "moon_1000", "moon_2400")
        val NON_CONSUMABLES = setOf("starter_pack", "remove_ads")
        const val TAG = "BrewBilling"
    }
    private val prefs = activity.getSharedPreferences("brewfall_billing", Context.MODE_PRIVATE)
    private val ledger = TokenLedger({ prefs.getStringSet("finished", emptySet()) ?: emptySet() }, { prefs.edit().putStringSet("finished", it).apply() })
    private val details = HashMap<String, ProductDetails>()
    private val licenseKey = BuildConfig.PLAY_LICENSE_KEY
    /** Without the Play licence key purchases cannot be verified, so the store stays closed rather than risk an undelivered charge. */
    private val enabled = licenseKey.isNotBlank()
    private val client: BillingClient? = if (!enabled) null else BillingClient.newBuilder(activity).setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection().build()
    private var connecting = false

    fun start() { connect { queryProducts(); syncPurchases(false) } }

    private fun connect(then: () -> Unit) {
        val c = client ?: return
        if (c.isReady) return then()
        if (connecting) return
        connecting = true
        c.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(r: BillingResult) { connecting = false; if (r.responseCode == BillingClient.BillingResponseCode.OK) then() else Log.w(TAG, "setup failed: ${r.debugMessage}") }
            override fun onBillingServiceDisconnected() { connecting = false }
        })
    }

    fun queryProducts() = connect {
        val products = (CONSUMABLES + NON_CONSUMABLES).map { QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(BillingClient.ProductType.INAPP).build() }
        client?.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build()) { r, result ->
            if (r.responseCode != BillingClient.BillingResponseCode.OK) return@queryProductDetailsAsync
            val prices = JSONObject()
            for (pd in result.productDetailsList) { details[pd.productId] = pd; pd.oneTimePurchaseOfferDetails?.let { prices.put(pd.productId, it.formattedPrice) } }
            activity.runOnUiThread { emit("products", JSONObject().put("prices", prices)) }
        }
    }

    /** Returns false when the purchase sheet cannot be opened; the game then shows a friendly message. */
    fun purchase(sku: String): Boolean {
        val c = client ?: return false
        val pd = details[sku]
        if (!c.isReady || pd == null) { start(); return false }
        val params = BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd).build())).build()
        return c.launchBillingFlow(activity, params).responseCode == BillingClient.BillingResponseCode.OK
    }

    override fun onPurchasesUpdated(r: BillingResult, purchases: MutableList<Purchase>?) {
        when (r.responseCode) {
            BillingClient.BillingResponseCode.OK -> purchases?.forEach { handle(it) }
            BillingClient.BillingResponseCode.USER_CANCELED -> error("Purchase cancelled. You were not charged.")
            BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> syncPurchases(true)
            BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE, BillingClient.BillingResponseCode.NETWORK_ERROR -> error("No connection to Google Play. Please try again.")
            else -> error("The purchase did not go through. You were not charged.")
        }
    }
    private fun error(msg: String) = activity.runOnUiThread { emit("purchaseError", JSONObject().put("message", msg)) }

    private fun handle(p: Purchase): Boolean {
        if (p.purchaseState == Purchase.PurchaseState.PENDING) { activity.runOnUiThread { emit("purchasePending", JSONObject()) }; return false }
        if (p.purchaseState != Purchase.PurchaseState.PURCHASED) return false
        if (!PurchaseVerifier.verify(licenseKey, p.originalJson, p.signature)) { Log.w(TAG, "signature check failed"); error("This purchase could not be verified."); return false }
        for (sku in p.products) {
            if (ledger.isFinished(p.purchaseToken) && sku in CONSUMABLES) { finish(sku, p.purchaseToken); continue } // already delivered: only retry the consume
            if (sku in NON_CONSUMABLES && p.isAcknowledged && ledger.isFinished(p.purchaseToken)) {
                activity.runOnUiThread { emit("purchase", JSONObject().put("sku", sku).put("token", p.purchaseToken).put("restored", true)) }; continue
            }
            activity.runOnUiThread { emit("purchase", JSONObject().put("sku", sku).put("token", p.purchaseToken)) }
        }
        return true
    }

    /** Called by the game after it has saved the reward. Consumes or acknowledges so Play does not refund it. */
    fun finish(sku: String, token: String) = connect {
        ledger.markFinished(token)
        if (sku in CONSUMABLES) client?.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(token).build()) { r, _ -> if (r.responseCode != BillingClient.BillingResponseCode.OK) Log.w(TAG, "consume will be retried: ${r.debugMessage}") }
        else client?.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build()) { r -> if (r.responseCode != BillingClient.BillingResponseCode.OK) Log.w(TAG, "acknowledge will be retried: ${r.debugMessage}") }
    }

    /** Re-delivers anything Play says the player owns (interrupted purchases, reinstall, new device). */
    fun syncPurchases(report: Boolean) {
        if (client == null) { if (report) activity.runOnUiThread { emit("restoreDone", JSONObject().put("count", 0)) }; return }
        connect {
            client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()) { r, list ->
                var n = 0
                if (r.responseCode == BillingClient.BillingResponseCode.OK) for (p in list) if (handle(p) && p.products.any { it in NON_CONSUMABLES }) n++
                if (report) activity.runOnUiThread { emit("restoreDone", JSONObject().put("count", n)) }
            }
        }
    }
    fun destroy() { try { client?.endConnection() } catch (e: Exception) {} }
}
