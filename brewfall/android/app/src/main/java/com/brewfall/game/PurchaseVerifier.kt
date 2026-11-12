package com.brewfall.game

import java.security.KeyFactory
import java.security.PublicKey
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

/** Checks that a purchase really was signed by Google Play for this app (local RSA check, no server needed). */
object PurchaseVerifier {
    fun publicKey(base64Key: String): PublicKey? = try {
        KeyFactory.getInstance("RSA").generatePublic(X509EncodedKeySpec(Base64.getDecoder().decode(base64Key.trim())))
    } catch (e: Exception) { null }

    fun verify(base64Key: String, signedData: String, signature: String): Boolean {
        if (base64Key.isBlank() || signedData.isEmpty() || signature.isEmpty()) return false
        val key = publicKey(base64Key) ?: return false
        return try {
            val sig = Signature.getInstance("SHA1withRSA")
            sig.initVerify(key); sig.update(signedData.toByteArray(Charsets.UTF_8))
            sig.verify(Base64.getDecoder().decode(signature))
        } catch (e: Exception) { false }
    }
}

/** Remembers which purchase tokens were already delivered, so nothing is ever granted twice. */
class TokenLedger(private val load: () -> Set<String>, private val store: (Set<String>) -> Unit) {
    private val seen = load().toMutableSet()
    @Synchronized fun isFinished(token: String) = token in seen
    @Synchronized fun markFinished(token: String): Boolean { val added = seen.add(token); if (added) store(seen.toSet()); return added }
}
