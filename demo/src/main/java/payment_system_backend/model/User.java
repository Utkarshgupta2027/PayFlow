package payment_system_backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "app_user")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String email;
    private String password;
    private double balance;

    @Column(name = "account_age_days", columnDefinition = "INT DEFAULT 0")
    private int accountAgeDays = 0;

    @Column(name = "phone_number", unique = true)
    private String phoneNumber;

    @Column(name = "referral_code", unique = true)
    private String referralCode;

    @Column(name = "referred_by")
    private String referredBy;

    // Role-based access: "USER" or "ADMIN"
    @Column(length = 20, columnDefinition = "VARCHAR(20) DEFAULT 'USER'")
    private String role = "USER";

    // Fraud / admin freeze
    @Column(columnDefinition = "BOOLEAN DEFAULT FALSE")
    private boolean frozen = false;

    // Device / session tracking
    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    // ─── Getters ─────────────────────────────────────────────────────────────

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getPassword() { return password; }
    public double getBalance() { return balance; }
    public int getAccountAgeDays() { return accountAgeDays; }
    public String getPhoneNumber() { return phoneNumber; }
    public String getReferralCode() { return referralCode; }
    public String getReferredBy() { return referredBy; }
    public String getRole() { return role; }
    public boolean isFrozen() { return frozen; }
    public LocalDateTime getLastLoginAt() { return lastLoginAt; }

    // ─── Setters ─────────────────────────────────────────────────────────────

    public void setId(Long id) { this.id = id; }
    public void setName(String name) { this.name = name; }
    public void setEmail(String email) { this.email = email; }
    public void setPassword(String password) { this.password = password; }
    public void setBalance(double balance) { this.balance = balance; }
    public void setAccountAgeDays(int accountAgeDays) { this.accountAgeDays = accountAgeDays; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public void setReferralCode(String referralCode) { this.referralCode = referralCode; }
    public void setReferredBy(String referredBy) { this.referredBy = referredBy; }
    public void setRole(String role) { this.role = role; }
    public void setFrozen(boolean frozen) { this.frozen = frozen; }
    public void setLastLoginAt(LocalDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }
}