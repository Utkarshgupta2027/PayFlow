package payment_system_backend.dto;

public class TopUpOfflineRequest {

    private double amount;
    private String transactionPin;

    public TopUpOfflineRequest() {}

    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }

    public String getTransactionPin() { return transactionPin; }
    public void setTransactionPin(String transactionPin) { this.transactionPin = transactionPin; }
}

