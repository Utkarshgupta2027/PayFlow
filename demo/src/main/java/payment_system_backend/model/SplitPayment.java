package payment_system_backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "split_payment")
public class SplitPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(name = "total_amount", nullable = false)
    private double totalAmount;

    @Column(name = "creator_id", nullable = false)
    private Long creatorId;

    /** OPEN | SETTLED */
    @Column(length = 20, columnDefinition = "VARCHAR(20) DEFAULT 'OPEN'")
    private String status = "OPEN";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "splitPayment", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SplitParticipant> participants = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    // ─── Getters ─────────────────────────────────────────────────────────────

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public double getTotalAmount() { return totalAmount; }
    public Long getCreatorId() { return creatorId; }
    public String getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public List<SplitParticipant> getParticipants() { return participants; }

    // ─── Setters ─────────────────────────────────────────────────────────────

    public void setId(Long id) { this.id = id; }
    public void setTitle(String title) { this.title = title; }
    public void setTotalAmount(double totalAmount) { this.totalAmount = totalAmount; }
    public void setCreatorId(Long creatorId) { this.creatorId = creatorId; }
    public void setStatus(String status) { this.status = status; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public void setParticipants(List<SplitParticipant> participants) { this.participants = participants; }
}
