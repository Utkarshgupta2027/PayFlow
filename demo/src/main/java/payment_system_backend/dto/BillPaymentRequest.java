package payment_system_backend.dto;

public class BillPaymentRequest {
    private String billType;
    private String provider;
    private String accountNumber;
    private double amount;
    private String description;

    public String getBillType() { return billType; }
    public void setBillType(String billType) { this.billType = billType; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }

    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
