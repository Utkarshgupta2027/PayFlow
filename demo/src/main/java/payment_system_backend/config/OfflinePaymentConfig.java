package payment_system_backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OfflinePaymentConfig {

    @Value("${offline.max-per-transaction:500.0}")
    private double maxPerTransaction;

    @Value("${offline.max-escrow:2000.0}")
    private double maxEscrow;

    @Value("${offline.certificate-validity-days:7}")
    private int certificateValidityDays;

    @Value("${offline.signing.private-key:${OFFLINE_SIGNING_PRIVATE_KEY:}}")
    private String signingPrivateKey;

    @Value("${offline.signing.public-key:${OFFLINE_SIGNING_PUBLIC_KEY:}}")
    private String signingPublicKey;

    public double getMaxPerTransaction() { return maxPerTransaction; }
    public double getMaxEscrow() { return maxEscrow; }
    public int getCertificateValidityDays() { return certificateValidityDays; }
    public String getSigningPrivateKey() { return signingPrivateKey; }
    public String getSigningPublicKey() { return signingPublicKey; }
}

