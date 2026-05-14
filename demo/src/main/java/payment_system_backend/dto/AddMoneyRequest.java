package payment_system_backend.dto;

public class AddMoneyRequest {

    private Long userId;
    private double amount;
    private String transactionPin;

    public Long getUserId() {
        return userId;
    }

    public double getAmount() {
        return amount;
    }

    public String getTransactionPin() {
        return transactionPin;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public void setAmount(double amount) {
        this.amount = amount;
    }

    public void setTransactionPin(String transactionPin) {
        this.transactionPin = transactionPin;
    }
}
