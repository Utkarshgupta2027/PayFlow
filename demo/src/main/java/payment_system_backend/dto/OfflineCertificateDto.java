package payment_system_backend.dto;

public class OfflineCertificateDto {

    private String certId;
    private Long userId;
    private String publicKey;
    private double escrowLimit;
    private String expiry;
    private String signature;

    public OfflineCertificateDto() {}

    public OfflineCertificateDto(String certId, Long userId, String publicKey, double escrowLimit, String expiry, String signature) {
        this.certId = certId;
        this.userId = userId;
        this.publicKey = publicKey;
        this.escrowLimit = escrowLimit;
        this.expiry = expiry;
        this.signature = signature;
    }

    public String getCertId() { return certId; }
    public void setCertId(String certId) { this.certId = certId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getPublicKey() { return publicKey; }
    public void setPublicKey(String publicKey) { this.publicKey = publicKey; }

    public double getEscrowLimit() { return escrowLimit; }
    public void setEscrowLimit(double escrowLimit) { this.escrowLimit = escrowLimit; }

    public String getExpiry() { return expiry; }
    public void setExpiry(String expiry) { this.expiry = expiry; }

    public String getSignature() { return signature; }
    public void setSignature(String signature) { this.signature = signature; }
}

