package payment_system_backend.dto;

public class CreatePaymentOrderRequest {

    private double amount;

    public double getAmount() {
        return amount;
    }

    public void setAmount(double amount) {
        this.amount = amount;
    }
}
