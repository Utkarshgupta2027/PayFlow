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

    // Payment gateway metadata for real money flows such as wallet top-ups.
    @Column(name = "gateway_provider", length = 30)
    private String gatewayProvider;

    @Column(name = "gateway_order_id", unique = true, length = 100)
    private String gatewayOrderId;

    @Column(name = "gateway_payment_id", length = 100)
    private String gatewayPaymentId;

    @Column(name = "gateway_signature", length = 255)
    private String gatewaySignature;

    @Column(name = "gateway_status", length = 30)
    private String gatewayStatus;

    @Column(name = "failure_reason", length = 255)
    private String failureReason;

    @Column(length = 3)
    private String currency = "INR";

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
    public String getGatewayProvider() { return gatewayProvider; }
    public String getGatewayOrderId() { return gatewayOrderId; }
    public String getGatewayPaymentId() { return gatewayPaymentId; }
    public String getGatewaySignature() { return gatewaySignature; }
    public String getGatewayStatus() { return gatewayStatus; }
    public String getFailureReason() { return failureReason; }
    public String getCurrency() { return currency; }

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
    public void setGatewayProvider(String gatewayProvider) { this.gatewayProvider = gatewayProvider; }
    public void setGatewayOrderId(String gatewayOrderId) { this.gatewayOrderId = gatewayOrderId; }
    public void setGatewayPaymentId(String gatewayPaymentId) { this.gatewayPaymentId = gatewayPaymentId; }
    public void setGatewaySignature(String gatewaySignature) { this.gatewaySignature = gatewaySignature; }
    public void setGatewayStatus(String gatewayStatus) { this.gatewayStatus = gatewayStatus; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }
    public void setCurrency(String currency) { this.currency = currency; }
}
