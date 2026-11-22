package payment_system_backend.dto;

public class RevokeOfflineRequest {

    private Long userId;
    private String reason;

    public RevokeOfflineRequest() {}

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}

