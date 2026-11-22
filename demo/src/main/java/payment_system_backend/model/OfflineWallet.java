package payment_system_backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "offline_wallet")
public class OfflineWallet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", unique = true, nullable = false)
    private Long userId;

    @Column(name = "public_key", columnDefinition = "TEXT", nullable = false)
    private String publicKey;

    @Column(name = "escrow_amount", nullable = false)
    private double escrowAmount = 0.0;

    @Column(name = "spent_amount", nullable = false)
    private double spentAmount = 0.0;

    @Column(name = "cert_id", unique = true, nullable = false)
    private String certId;

    @Column(name = "expiry", nullable = false)
    private LocalDateTime expiry;

    // Status: ACTIVE, REVOKED, EXPIRED
    @Column(name = "status", length = 20, nullable = false)
    private String status = "ACTIVE";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Version
    private Long version;

    public OfflineWallet() {}

    // ─── Getters and Setters ──────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getPublicKey() { return publicKey; }
    public void setPublicKey(String publicKey) { this.publicKey = publicKey; }

    public double getEscrowAmount() { return escrowAmount; }
    public void setEscrowAmount(double escrowAmount) { this.escrowAmount = escrowAmount; }

    public double getSpentAmount() { return spentAmount; }
    public void setSpentAmount(double spentAmount) { this.spentAmount = spentAmount; }

    public double getRemainingAmount() {
        return Math.max(0.0, this.escrowAmount - this.spentAmount);
    }

    public String getCertId() { return certId; }
    public void setCertId(String certId) { this.certId = certId; }

    public LocalDateTime getExpiry() { return expiry; }
    public void setExpiry(LocalDateTime expiry) { this.expiry = expiry; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}

