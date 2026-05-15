package payment_system_backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "favorite_contact",
        uniqueConstraints = @UniqueConstraint(columnNames = {"owner_id", "contact_user_id"})
)
public class FavoriteContact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "contact_user_id", nullable = false)
    private Long contactUserId;

    @Column(length = 80)
    private String nickname;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getOwnerId() { return ownerId; }
    public Long getContactUserId() { return contactUserId; }
    public String getNickname() { return nickname; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setId(Long id) { this.id = id; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public void setContactUserId(Long contactUserId) { this.contactUserId = contactUserId; }
    public void setNickname(String nickname) { this.nickname = nickname; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
