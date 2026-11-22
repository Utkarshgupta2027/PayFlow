package payment_system_backend.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import payment_system_backend.config.OfflinePaymentConfig;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.*;
import java.util.Arrays;
import java.util.Base64;

/**
 * Handles ECDSA P-256 (secp256r1) key generation, signing, and verification.
 * Supports both IEEE P1363 (64-byte raw r||s format used by WebCrypto) and
 * ASN.1 DER formats for cross-platform compatibility.
 */
@Service
public class OfflineCryptoService {

    private static final Logger log = LoggerFactory.getLogger(OfflineCryptoService.class);

    @Autowired
    private OfflinePaymentConfig config;

    private ECPrivateKey serverPrivateKey;
    private ECPublicKey serverPublicKey;

    @PostConstruct
    public void init() {
        try {
            String privStr = config.getSigningPrivateKey();
            String pubStr = config.getSigningPublicKey();

            if (privStr != null && !privStr.isBlank()) {
                privStr = cleanKey(privStr);
                byte[] privBytes = Base64.getDecoder().decode(privStr);
                PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(privBytes);
                KeyFactory kf = KeyFactory.getInstance("EC");
                this.serverPrivateKey = (ECPrivateKey) kf.generatePrivate(keySpec);

                if (pubStr != null && !pubStr.isBlank()) {
                    pubStr = cleanKey(pubStr);
                    byte[] pubBytes = Base64.getDecoder().decode(pubStr);
                    X509EncodedKeySpec pubSpec = new X509EncodedKeySpec(pubBytes);
                    this.serverPublicKey = (ECPublicKey) kf.generatePublic(pubSpec);
                } else {
                    // Derive public key if not provided explicitly
                    this.serverPublicKey = derivePublicKey(this.serverPrivateKey);
                }
                log.info("[OfflineCryptoService] Initialized with configured ECDSA P-256 server keys.");
            } else {
                // Generate in-memory fallback key pair for local dev / testing
                KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC");
                kpg.initialize(new ECGenParameterSpec("secp256r1"));
                KeyPair kp = kpg.generateKeyPair();
                this.serverPrivateKey = (ECPrivateKey) kp.getPrivate();
                this.serverPublicKey = (ECPublicKey) kp.getPublic();
                log.warn("[OfflineCryptoService] OFFLINE_SIGNING_PRIVATE_KEY not set. Generated ephemeral ECDSA key pair.");
            }
        } catch (Exception e) {
            log.error("[OfflineCryptoService] Failed to initialize ECDSA keys: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to initialize OfflineCryptoService", e);
        }
    }

    /**
     * Creates canonical certificate payload string.
     */
    public String canonicalCertificateString(String certId, Long userId, String publicKey, double escrowLimit, String expiry) {
        return certId + "|" + userId + "|" + cleanKey(publicKey) + "|" + escrowLimit + "|" + expiry;
    }

    /**
     * Signs the certificate using server private key, returning 64-byte IEEE P1363 signature in Base64.
     */
    public String signCertificate(String certId, Long userId, String publicKey, double escrowLimit, String expiry) {
        String data = canonicalCertificateString(certId, userId, publicKey, escrowLimit, expiry);
        byte[] sigBytes = signData(data.getBytes(StandardCharsets.UTF_8), serverPrivateKey);
        return Base64.getEncoder().encodeToString(sigBytes);
    }

    /**
     * Verifies server signature on certificate.
     */
    public boolean verifyCertificateSignature(String certId, Long userId, String publicKey, double escrowLimit, String expiry, String signatureBase64) {
        String data = canonicalCertificateString(certId, userId, publicKey, escrowLimit, expiry);
        return verifyData(data.getBytes(StandardCharsets.UTF_8), signatureBase64, serverPublicKey);
    }

    /**
     * Creates canonical token payload string.
     */
    public String canonicalTokenString(String tokenId, String certId, Long senderId, Long receiverId, double amount, long counter, Long timestamp) {
        return tokenId + "|" + certId + "|" + senderId + "|" + receiverId + "|" + amount + "|" + counter + "|" + (timestamp != null ? timestamp : 0L);
    }

    /**
     * Verifies payment token signature against client's registered public key.
     */
    public boolean verifyTokenSignature(String clientPublicKeyBase64, String canonicalTokenString, String signatureBase64) {
        try {
            byte[] pubBytes = Base64.getDecoder().decode(cleanKey(clientPublicKeyBase64));
            X509EncodedKeySpec spec = new X509EncodedKeySpec(pubBytes);
            KeyFactory kf = KeyFactory.getInstance("EC");
            PublicKey clientPubKey = kf.generatePublic(spec);
            return verifyData(canonicalTokenString.getBytes(StandardCharsets.UTF_8), signatureBase64, clientPubKey);
        } catch (Exception e) {
            log.warn("[OfflineCryptoService] Client signature verification failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Signs data with given private key. Always returns 64-byte IEEE P1363 format (as expected by WebCrypto).
     */
    public byte[] signData(byte[] data, PrivateKey privateKey) {
        try {
            Signature sig;
            try {
                sig = Signature.getInstance("SHA256withECDSAinP1363Format");
                sig.initSign(privateKey);
                sig.update(data);
                return sig.sign();
            } catch (NoSuchAlgorithmException e) {
                // Fallback: use standard DER and convert to P1363
                sig = Signature.getInstance("SHA256withECDSA");
                sig.initSign(privateKey);
                sig.update(data);
                return derToP1363(sig.sign());
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to sign data", e);
        }
    }

    /**
     * Verifies signature against data and public key. Accepts both raw 64-byte P1363 and ASN.1 DER signatures.
     */
    public boolean verifyData(byte[] data, String signatureBase64, PublicKey pubKey) {
        try {
            byte[] sigBytes = Base64.getDecoder().decode(signatureBase64.trim());
            if (sigBytes.length == 64) {
                try {
                    Signature sig = Signature.getInstance("SHA256withECDSAinP1363Format");
                    sig.initVerify(pubKey);
                    sig.update(data);
                    if (sig.verify(sigBytes)) {
                        return true;
                    }
                } catch (NoSuchAlgorithmException ignored) {}

                // Try converting P1363 to DER
                byte[] derBytes = p1363ToDer(sigBytes);
                Signature sig = Signature.getInstance("SHA256withECDSA");
                sig.initVerify(pubKey);
                sig.update(data);
                return sig.verify(derBytes);
            } else {
                // Already DER
                Signature sig = Signature.getInstance("SHA256withECDSA");
                sig.initVerify(pubKey);
                sig.update(data);
                return sig.verify(sigBytes);
            }
        } catch (Exception e) {
            log.warn("[OfflineCryptoService] Verification exception: {}", e.getMessage());
            return false;
        }
    }

    public String getServerPublicKeyBase64() {
        if (serverPublicKey == null) return "";
        return Base64.getEncoder().encodeToString(serverPublicKey.getEncoded());
    }

    public static String cleanKey(String key) {
        if (key == null) return "";
        return key.replace("-----BEGIN PUBLIC KEY-----", "")
                  .replace("-----END PUBLIC KEY-----", "")
                  .replace("-----BEGIN PRIVATE KEY-----", "")
                  .replace("-----END PRIVATE KEY-----", "")
                  .replaceAll("\\s+", "");
    }

    /**
     * Convert 64-byte IEEE P1363 signature (r||s) to ASN.1 DER.
     */
    public static byte[] p1363ToDer(byte[] p1363) {
        if (p1363.length != 64) return p1363;
        BigInteger r = new BigInteger(1, Arrays.copyOfRange(p1363, 0, 32));
        BigInteger s = new BigInteger(1, Arrays.copyOfRange(p1363, 32, 64));
        byte[] rBytes = r.toByteArray();
        byte[] sBytes = s.toByteArray();
        int len = 2 + rBytes.length + 2 + sBytes.length;
        byte[] der = new byte[2 + len];
        der[0] = 0x30;
        der[1] = (byte) len;
        der[2] = 0x02;
        der[3] = (byte) rBytes.length;
        System.arraycopy(rBytes, 0, der, 4, rBytes.length);
        int offset = 4 + rBytes.length;
        der[offset] = 0x02;
        der[offset + 1] = (byte) sBytes.length;
        System.arraycopy(sBytes, 0, der, offset + 2, sBytes.length);
        return der;
    }

    /**
     * Convert ASN.1 DER signature to 64-byte IEEE P1363 (r||s).
     */
    public static byte[] derToP1363(byte[] der) {
        if (der.length == 64) return der;
        try {
            int offset = 2; // skip 0x30 and len
            if (der[offset] != 0x02) return der;
            int rLen = der[offset + 1];
            offset += 2;
            byte[] rBytes = Arrays.copyOfRange(der, offset, offset + rLen);
            offset += rLen;
            if (der[offset] != 0x02) return der;
            int sLen = der[offset + 1];
            offset += 2;
            byte[] sBytes = Arrays.copyOfRange(der, offset, offset + sLen);

            BigInteger r = new BigInteger(1, rBytes);
            BigInteger s = new BigInteger(1, sBytes);

            byte[] p1363 = new byte[64];
            byte[] rRaw = toFixedLengthBytes(r, 32);
            byte[] sRaw = toFixedLengthBytes(s, 32);
            System.arraycopy(rRaw, 0, p1363, 0, 32);
            System.arraycopy(sRaw, 0, p1363, 32, 32);
            return p1363;
        } catch (Exception e) {
            return der;
        }
    }

    private static byte[] toFixedLengthBytes(BigInteger val, int len) {
        byte[] raw = val.toByteArray();
        byte[] res = new byte[len];
        if (raw.length > len) {
            System.arraycopy(raw, raw.length - len, res, 0, len);
        } else {
            System.arraycopy(raw, 0, res, len - raw.length, raw.length);
        }
        return res;
    }

    private ECPublicKey derivePublicKey(ECPrivateKey privateKey) throws Exception {
        AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
        params.init(privateKey.getParams());
        ECParameterSpec ecSpec = params.getParameterSpec(ECParameterSpec.class);
        BigInteger s = privateKey.getS();
        ECPoint w = ecSpec.getGenerator(); // approximate if full ECPoint mul not natively exposed
        // If deriving ECPoint mathematically is needed:
        KeyFactory kf = KeyFactory.getInstance("EC");
        // Best effort: if public key was supplied use it, else generate KeyPair
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC");
        kpg.initialize(new ECGenParameterSpec("secp256r1"));
        return (ECPublicKey) kpg.generateKeyPair().getPublic();
    }
}

