package payment_system_backend.dto;

public class ReleaseOfflineRequest {

    private String transactionPin;

    public ReleaseOfflineRequest() {}

    public String getTransactionPin() { return transactionPin; }
    public void setTransactionPin(String transactionPin) { this.transactionPin = transactionPin; }
}

