package payment_system_backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "split_participant")
public class SplitParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "split_payment_id", nullable = false)
    @JsonIgnore
    private SplitPayment splitPayment;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "user_name", length = 100)
    private String userName;

    @Lob
    @Column(name = "profile_picture_url", columnDefinition = "TEXT")
    private String profilePictureUrl;

    @Column(name = "amount_owed", nullable = false)
    private double amountOwed;

    @Column(name = "amount_paid", columnDefinition = "DOUBLE DEFAULT 0")
    private double amountPaid = 0;

    @Column(columnDefinition = "BOOLEAN DEFAULT FALSE")
    private boolean paid = false;

    // ─── Getters ─────────────────────────────────────────────────────────────

    public Long getId() { return id; }
    public SplitPayment getSplitPayment() { return splitPayment; }
    public Long getUserId() { return userId; }
    public String getUserName() { return userName; }
    public String getProfilePictureUrl() { return profilePictureUrl; }
    public double getAmountOwed() { return amountOwed; }
    public double getAmountPaid() { return amountPaid; }
    public boolean isPaid() { return paid; }

    // ─── Setters ─────────────────────────────────────────────────────────────

    public void setId(Long id) { this.id = id; }
    public void setSplitPayment(SplitPayment splitPayment) { this.splitPayment = splitPayment; }
    public void setUserId(Long userId) { this.userId = userId; }
    public void setUserName(String userName) { this.userName = userName; }
    public void setProfilePictureUrl(String profilePictureUrl) { this.profilePictureUrl = profilePictureUrl; }
    public void setAmountOwed(double amountOwed) { this.amountOwed = amountOwed; }
    public void setAmountPaid(double amountPaid) { this.amountPaid = amountPaid; }
    public void setPaid(boolean paid) { this.paid = paid; }
}
