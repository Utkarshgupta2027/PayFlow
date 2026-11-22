package payment_system_backend.dto;

public class OfflineTokenDto {

    private String tokenId;
    private String certId;
    private Long senderId;
    private Long receiverId;
    private double amount;
    private long counter;
    private Long timestamp; // epoch millis from client
    private String signature;

    public OfflineTokenDto() {}

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

    public Long getTimestamp() { return timestamp; }
    public void setTimestamp(Long timestamp) { this.timestamp = timestamp; }

    public String getSignature() { return signature; }
    public void setSignature(String signature) { this.signature = signature; }
}

