package payment_system_backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long senderId;
    private Long receiverId;
    private double amount;
    private String status;
    private LocalDateTime time;

    // Fraud detection
    @Column(name = "risk_score", columnDefinition = "DOUBLE DEFAULT 0")
    private double riskScore = 0;

    @Column(name = "risk_level", length = 10, columnDefinition = "VARCHAR(10) DEFAULT 'LOW'")
    private String riskLevel = "LOW";

    // Spending category
    @Column(length = 30, columnDefinition = "VARCHAR(30) DEFAULT 'TRANSFER'")
    private String category = "TRANSFER";

    // Optional description/note
    @Column(length = 255)
    private String description;

    // Refund flow: null | PENDING | APPROVED | REJECTED
    @Column(name = "refund_status", length = 20)
    private String refundStatus;

    @Column(name = "refund_requested_by")
    private Long refundRequestedBy;

    // ─── Getters ─────────────────────────────────────────────────────────────

    public Long getId() { return id; }
    public Long getSenderId() { return senderId; }
    public Long getReceiverId() { return receiverId; }
    public double getAmount() { return amount; }
    public String getStatus() { return status; }
    public LocalDateTime getTime() { return time; }
    public double getRiskScore() { return riskScore; }
    public String getRiskLevel() { return riskLevel; }
    public String getCategory() { return category; }
    public String getDescription() { return description; }
    public String getRefundStatus() { return refundStatus; }
    public Long getRefundRequestedBy() { return refundRequestedBy; }

    // ─── Setters ─────────────────────────────────────────────────────────────

    public void setSenderId(Long senderId) { this.senderId = senderId; }
    public void setReceiverId(Long receiverId) { this.receiverId = receiverId; }
    public void setAmount(double amount) { this.amount = amount; }
    public void setStatus(String status) { this.status = status; }
    public void setTime(LocalDateTime time) { this.time = time; }
    public void setRiskScore(double riskScore) { this.riskScore = riskScore; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
    public void setCategory(String category) { this.category = category; }
    public void setDescription(String description) { this.description = description; }
    public void setRefundStatus(String refundStatus) { this.refundStatus = refundStatus; }
    public void setRefundRequestedBy(Long refundRequestedBy) { this.refundRequestedBy = refundRequestedBy; }
}