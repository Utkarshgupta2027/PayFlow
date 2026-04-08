package payment_system_backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "bank_account")
public class BankAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    @Column(name = "account_holder_name")
    private String accountHolderName;

    @Column(name = "account_number")
    private String accountNumber;  // stored masked, last 4 digits

    @Column(name = "account_number_full")
    private String accountNumberFull; // full number for dedup check

    @Column(name = "ifsc_code")
    private String ifscCode;

    @Column(name = "bank_name")
    private String bankName;

    @Column(name = "account_type")
    private String accountType; // SAVINGS / CURRENT

    @Column(name = "is_primary", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private boolean primary = false;

    // Getters
    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getAccountHolderName() { return accountHolderName; }
    public String getAccountNumber() { return accountNumber; }
    public String getAccountNumberFull() { return accountNumberFull; }
    public String getIfscCode() { return ifscCode; }
    public String getBankName() { return bankName; }
    public String getAccountType() { return accountType; }
    public boolean isPrimary() { return primary; }

    // Setters
    public void setId(Long id) { this.id = id; }
    public void setUserId(Long userId) { this.userId = userId; }
    public void setAccountHolderName(String accountHolderName) { this.accountHolderName = accountHolderName; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }
    public void setAccountNumberFull(String accountNumberFull) { this.accountNumberFull = accountNumberFull; }
    public void setIfscCode(String ifscCode) { this.ifscCode = ifscCode; }
    public void setBankName(String bankName) { this.bankName = bankName; }
    public void setAccountType(String accountType) { this.accountType = accountType; }
    public void setPrimary(boolean primary) { this.primary = primary; }
}
