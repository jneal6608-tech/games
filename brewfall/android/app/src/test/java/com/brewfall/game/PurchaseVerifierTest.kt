package com.brewfall.game

import org.junit.Assert.*
import org.junit.Test
import java.security.KeyPairGenerator
import java.security.Signature
import java.util.Base64

class PurchaseVerifierTest {
    private val pair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
    private val key = Base64.getEncoder().encodeToString(pair.public.encoded)
    private fun sign(data: String) = Base64.getEncoder().encodeToString(Signature.getInstance("SHA1withRSA").apply { initSign(pair.private); update(data.toByteArray()) }.sign())
    private val json = """{"orderId":"GPA.1","productId":"moon_80","purchaseToken":"tok"}"""

    @Test fun acceptsGenuineSignature() = assertTrue(PurchaseVerifier.verify(key, json, sign(json)))
    @Test fun rejectsTamperedData() = assertFalse(PurchaseVerifier.verify(key, json.replace("moon_80", "moon_2400"), sign(json)))
    @Test fun rejectsForgedSignature() = assertFalse(PurchaseVerifier.verify(key, json, Base64.getEncoder().encodeToString(ByteArray(256) { 7 })))
    @Test fun rejectsWrongKey() { val other = Base64.getEncoder().encodeToString(KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair().public.encoded); assertFalse(PurchaseVerifier.verify(other, json, sign(json))) }
    @Test fun rejectsBlankOrGarbageInputs() { assertFalse(PurchaseVerifier.verify("", json, sign(json))); assertFalse(PurchaseVerifier.verify("not-a-key", json, sign(json))); assertFalse(PurchaseVerifier.verify(key, json, "%%%")); assertFalse(PurchaseVerifier.verify(key, "", "")) }
    @Test fun ledgerDeliversEachTokenOnce() {
        var stored = setOf<String>()
        val l = TokenLedger({ stored }, { stored = it })
        assertFalse(l.isFinished("a")); assertTrue(l.markFinished("a")); assertFalse(l.markFinished("a")); assertTrue(l.isFinished("a"))
        assertTrue(TokenLedger({ stored }, { stored = it }).isFinished("a")) // survives a restart
    }
}
