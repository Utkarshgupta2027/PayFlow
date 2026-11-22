package payment_system_backend.dto;

import payment_system_backend.model.OfflineWallet;
import java.util.Map;

public class OfflineWalletStatusResponse {

    private boolean active;
    private OfflineWallet wallet;
    private double remainingEscrow;
    private OfflineCertificateDto certificate;
    private Map<String, Object> config;

    public OfflineWalletStatusResponse() {}

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public OfflineWallet getWallet() { return wallet; }
    public void setWallet(OfflineWallet wallet) { this.wallet = wallet; }

    public double getRemainingEscrow() { return remainingEscrow; }
    public void setRemainingEscrow(double remainingEscrow) { this.remainingEscrow = remainingEscrow; }

    public OfflineCertificateDto getCertificate() { return certificate; }
    public void setCertificate(OfflineCertificateDto certificate) { this.certificate = certificate; }

    public Map<String, Object> getConfig() { return config; }
    public void setConfig(Map<String, Object> config) { this.config = config; }
}

