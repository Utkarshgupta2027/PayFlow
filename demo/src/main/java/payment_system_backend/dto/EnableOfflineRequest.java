package payment_system_backend.dto;

public class EnableOfflineRequest {

    private String publicKey;
    private double amount;
    private String transactionPin;

    public EnableOfflineRequest() {}

    public String getPublicKey() { return publicKey; }
    public void setPublicKey(String publicKey) { this.publicKey = publicKey; }

    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }

    public String getTransactionPin() { return transactionPin; }
    public void setTransactionPin(String transactionPin) { this.transactionPin = transactionPin; }
}

