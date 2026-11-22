package payment_system_backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import payment_system_backend.config.OfflinePaymentConfig;
import payment_system_backend.service.OfflineCryptoService;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class OfflineCryptoServiceTest {

    private OfflineCryptoService cryptoService;
    private OfflinePaymentConfig config;

    @BeforeEach
    void setUp() {
        cryptoService = new OfflineCryptoService();
        config = new OfflinePaymentConfig();
        ReflectionTestUtils.setField(cryptoService, "config", config);
        cryptoService.init();
    }

    @Test
    void testCertificateSigningAndVerification() {
        String certId = "cert-12345";
        Long userId = 42L;
        String clientPubKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAElBZKtJ+TE9FvLwfeD0mXErHj01niLuCjdATFr5P5oXlhYYBqqgxevjH9m1MVOuVL1EOR5jVkn3TOBtfNsmUFbg==";
        double escrowLimit = 1000.0;
        String expiry = "2026-11-29T12:00:00";

        String signature = cryptoService.signCertificate(certId, userId, clientPubKey, escrowLimit, expiry);
        assertNotNull(signature);
        assertFalse(signature.isBlank());

        // Signature should be valid
        boolean valid = cryptoService.verifyCertificateSignature(certId, userId, clientPubKey, escrowLimit, expiry, signature);
        assertTrue(valid, "Certificate signature should verify successfully");

        // Tampered payload should fail
        boolean tampered = cryptoService.verifyCertificateSignature(certId, userId, clientPubKey, escrowLimit + 100.0, expiry, signature);
        assertFalse(tampered, "Tampered escrow limit must fail verification");

        // Tampered user ID should fail
        boolean tamperedUser = cryptoService.verifyCertificateSignature(certId, 999L, clientPubKey, escrowLimit, expiry, signature);
        assertFalse(tamperedUser, "Tampered userId must fail verification");
    }

    @Test
    void testClientTokenSignatureVerification() throws Exception {
        // Generate an ephemeral client EC key pair
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC");
        kpg.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair clientKp = kpg.generateKeyPair();
        String clientPubKeyBase64 = Base64.getEncoder().encodeToString(clientKp.getPublic().getEncoded());

        String canonicalToken = cryptoService.canonicalTokenString("tok-1", "cert-1", 42L, 99L, 150.0, 1L, 1732262400000L);

        // Sign token with client private key (returns IEEE P1363 64-byte format)
        byte[] sigBytes = cryptoService.signData(canonicalToken.getBytes(StandardCharsets.UTF_8), clientKp.getPrivate());
        String sigBase64 = Base64.getEncoder().encodeToString(sigBytes);

        // Verify valid token
        boolean verified = cryptoService.verifyTokenSignature(clientPubKeyBase64, canonicalToken, sigBase64);
        assertTrue(verified, "Token signature signed with client private key must verify with client public key");

        // Tampered token amount
        String tamperedToken = cryptoService.canonicalTokenString("tok-1", "cert-1", 42L, 99L, 999.0, 1L, 1732262400000L);
        boolean tamperedVerified = cryptoService.verifyTokenSignature(clientPubKeyBase64, tamperedToken, sigBase64);
        assertFalse(tamperedVerified, "Tampered token amount must fail verification");
    }

    @Test
    void testServerPublicKeyExport() {
        String pubKey = cryptoService.getServerPublicKeyBase64();
        assertNotNull(pubKey);
        assertFalse(pubKey.isBlank());
        // Standard X.509 SPKI for P-256 is 91 bytes (~124 chars Base64)
        byte[] decoded = Base64.getDecoder().decode(pubKey);
        assertEquals(91, decoded.length, "ECDSA P-256 SPKI public key should be 91 bytes");
    }
}

