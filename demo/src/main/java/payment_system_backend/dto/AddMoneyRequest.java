package payment_system_backend.dto;

public class AddMoneyRequest {

    private Long userId;
    private double amount;

    public Long getUserId() {
        return userId;
    }

    public double getAmount() {
        return amount;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public void setAmount(double amount) {
        this.amount = amount;
    }
}