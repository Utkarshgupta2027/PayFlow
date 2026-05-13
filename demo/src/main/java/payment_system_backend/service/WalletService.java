package payment_system_backend.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import payment_system_backend.model.BankAccount;
import payment_system_backend.model.Transaction;
import payment_system_backend.model.User;
import payment_system_backend.repository.BankAccountRepository;
import payment_system_backend.repository.TransactionRepository;
import payment_system_backend.repository.UserRepository;

import java.time.LocalDateTime;

@Service
public class WalletService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BankAccountRepository bankAccountRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private NotificationService notificationService;

    public User addMoney(Long userId, double amount){

        User user = userRepository.findById(userId).orElseThrow();

        user.setBalance(user.getBalance() + amount);

        return userRepository.save(user);
    }

    @Transactional
    public Transaction withdrawToBank(Long userId, double amount, Long bankAccountId, String description) {
        if (amount <= 0) {
            throw new RuntimeException("Withdrawal amount must be greater than zero");
        }

        User user = userRepository.findById(userId).orElseThrow(() ->
                new RuntimeException("User not found"));

        if (user.isFrozen()) {
            throw new RuntimeException("Your account has been frozen. Please contact support.");
        }

        if (user.getBalance() < amount) {
            throw new RuntimeException("Insufficient wallet balance");
        }

        BankAccount account = resolveWithdrawalAccount(userId, bankAccountId);

        user.setBalance(user.getBalance() - amount);
        userRepository.save(user);

        Transaction tx = new Transaction();
        tx.setSenderId(userId);
        tx.setAmount(amount);
        tx.setStatus("SUCCESS");
        tx.setTime(LocalDateTime.now());
        tx.setRiskScore(0);
        tx.setRiskLevel("LOW");
        tx.setCategory("WITHDRAWAL");
        tx.setDescription(buildWithdrawalDescription(account, description));
        tx.setGatewayProvider("BANK_TRANSFER");
        tx.setGatewayStatus("PAYOUT_INITIATED");
        tx.setCurrency("INR");
        transactionRepository.save(tx);

        notificationService.pushBalanceUpdate(userId, user.getBalance());
        notificationService.createNotification(userId,
                "Bank withdrawal initiated",
                "Withdrawal of INR " + String.format("%.2f", amount)
                        + " to " + account.getBankName() + " " + account.getAccountNumber() + " has been initiated.",
                "SUCCESS");

        notificationService.sendEmail(user.getEmail(),
                "PayFlow - Bank Withdrawal",
                "Hi " + user.getName() + ",\n\nYour withdrawal of INR " + String.format("%.2f", amount)
                        + " to " + account.getBankName() + " " + account.getAccountNumber()
                        + " has been initiated.\n\nTransaction ID: " + tx.getId()
                        + "\n\nPayFlow Team");

        return tx;
    }

    private BankAccount resolveWithdrawalAccount(Long userId, Long bankAccountId) {
        if (bankAccountId != null) {
            return bankAccountRepository.findByIdAndUserId(bankAccountId, userId).orElseThrow(() ->
                    new RuntimeException("Bank account not found for this user"));
        }

        return bankAccountRepository.findFirstByUserIdAndPrimaryTrue(userId)
                .orElseGet(() -> bankAccountRepository.findByUserId(userId).stream().findFirst()
                        .orElseThrow(() -> new RuntimeException("Link a bank account before withdrawing money")));
    }

    private String buildWithdrawalDescription(BankAccount account, String description) {
        String base = "Withdrawal to " + account.getBankName() + " " + account.getAccountNumber();
        if (description == null || description.isBlank()) {
            return base;
        }
        return base + " - " + description.trim();
    }
}
