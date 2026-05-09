package payment_system_backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "otp_records")
public class OtpRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String identifier;
    private String otp;
    private LocalDateTime createdAt;

    public OtpRecord() {}

    public OtpRecord(String identifier, String otp, LocalDateTime createdAt) {
        this.identifier = identifier;
        this.otp = otp;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getIdentifier() { return identifier; }
    public String getOtp() { return otp; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setId(Long id) { this.id = id; }
    public void setIdentifier(String identifier) { this.identifier = identifier; }
    public void setOtp(String otp) { this.otp = otp; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
