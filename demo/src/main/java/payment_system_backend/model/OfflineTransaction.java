package payment_system_backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "offline_transaction",
    indexes = {
        @Index(name = "idx_off_tx_token_id", columnList = "token_id", unique = true),
        @Index(name = "idx_off_tx_cert_id", columnList = "cert_id"),
        @Index(name = "idx_off_tx_sender", columnList = "sender_id"),
        @Index(name = "idx_off_tx_receiver", columnList = "receiver_id")
    }
)
public class OfflineTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "token_id", unique = true, nullable = false, length = 100)
    private String tokenId;

    @Column(name = "cert_id", nullable = false, length = 100)
    private String certId;

    @Column(name = "sender_id", nullable = false)
    private Long senderId;

    @Column(name = "receiver_id", nullable = false)
    private Long receiverId;

    @Column(name = "amount", nullable = false)
    private double amount;

    @Column(name = "counter", nullable = false)
    private long counter;

    @Column(name = "token_timestamp")
    private LocalDateTime tokenTimestamp;

    // Status: SETTLED, REJECTED
    @Column(name = "status", length = 20, nullable = false)
    private String status;

    @Column(name = "reject_reason", length = 255)
    private String rejectReason;

    @Column(name = "settled_at")
    private LocalDateTime settledAt;

    public OfflineTransaction() {}

    // ─── Getters and Setters ──────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTokenId() { return tokenId; }
    public void setTokenId(String tokenId) { this.tokenId = tokenId; }

    public String getCertId() { return certId; }
    public void setCertId(String certId) { this.certId = certId; }

    public Long getSenderId() { return senderId; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }

    public Long getReceiverId() { return receiverId; }
    public void setReceiverId(Long receiverId) { this.receiverId = receiverId; }

    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }

    public long getCounter() { return counter; }
    public void setCounter(long counter) { this.counter = counter; }

    public LocalDateTime getTokenTimestamp() { return tokenTimestamp; }
    public void setTokenTimestamp(LocalDateTime tokenTimestamp) { this.tokenTimestamp = tokenTimestamp; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getRejectReason() { return rejectReason; }
    public void setRejectReason(String rejectReason) { this.rejectReason = rejectReason; }

    public LocalDateTime getSettledAt() { return settledAt; }
    public void setSettledAt(LocalDateTime settledAt) { this.settledAt = settledAt; }
}

