package payment_system_backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "money_request")
public class MoneyRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "requester_id", nullable = false)
    private Long requesterId;

    @Column(name = "target_user_id", nullable = false)
    private Long targetUserId;

    private double amount;

    @Column(length = 255)
    private String description;

    // PENDING, ACCEPTED, DECLINED, CANCELLED
    @Column(length = 20, nullable = false)
    private String status = "PENDING";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    // ─── Getters ─────────────────────────────────────────────────────────────

    public Long getId() { return id; }
    public Long getRequesterId() { return requesterId; }
    public Long getTargetUserId() { return targetUserId; }
    public double getAmount() { return amount; }
    public String getDescription() { return description; }
    public String getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    // ─── Setters ─────────────────────────────────────────────────────────────

    public void setId(Long id) { this.id = id; }
    public void setRequesterId(Long requesterId) { this.requesterId = requesterId; }
    public void setTargetUserId(Long targetUserId) { this.targetUserId = targetUserId; }
    public void setAmount(double amount) { this.amount = amount; }
    public void setDescription(String description) { this.description = description; }
    public void setStatus(String status) { this.status = status; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
