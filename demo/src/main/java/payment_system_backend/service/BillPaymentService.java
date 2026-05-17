package payment_system_backend.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import payment_system_backend.model.Transaction;
import payment_system_backend.model.User;
import payment_system_backend.repository.TransactionRepository;
import payment_system_backend.repository.UserRepository;

import java.time.LocalDateTime;

@Service
public class BillPaymentService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private RewardService rewardService;

    @Transactional
    public BillPaymentResult payBill(Long userId, String billType, String provider,
                                     String accountNumber, double amount, String description) {
        if (amount <= 0) {
            throw new RuntimeException("Amount must be greater than zero");
        }
        if (billType == null || billType.isBlank()) {
            throw new RuntimeException("Bill type is required");
        }
        if (provider == null || provider.isBlank()) {
            throw new RuntimeException("Provider is required");
        }
        if (accountNumber == null || accountNumber.isBlank()) {
            throw new RuntimeException("Consumer number or mobile number is required");
        }

        User user = userRepository.findById(userId).orElseThrow(() ->
                new RuntimeException("User not found"));
        if (user.isFrozen()) {
            throw new RuntimeException("Your account has been frozen. Please contact support.");
        }
        if (user.getBalance() < amount) {
            throw new RuntimeException("Insufficient wallet balance");
        }

        String normalizedType = billType.trim().toUpperCase();
        user.setBalance(user.getBalance() - amount);

        double cashback = rewardService.calculateCashback(amount, normalizedType);
        if (cashback > 0) {
            user.setBalance(user.getBalance() + cashback);
        }
        userRepository.save(user);

        Transaction tx = new Transaction();
        tx.setSenderId(userId);
        tx.setAmount(amount);
        tx.setStatus("SUCCESS");
        tx.setTime(LocalDateTime.now());
        tx.setRiskScore(0);
        tx.setRiskLevel("LOW");
        tx.setCategory("BILL_" + normalizedType);
        tx.setDescription(buildDescription(normalizedType, provider, accountNumber, description, cashback));
        tx.setGatewayProvider("BILL_PAY");
        tx.setGatewayStatus("PAID");
        tx.setCurrency("INR");
        transactionRepository.save(tx);

        int pointsAwarded = rewardService.awardTransactionPoints(userId, amount);
        notificationService.pushBalanceUpdate(userId, user.getBalance());
        notificationService.createNotification(userId,
                "Bill paid",
                provider.trim() + " payment of INR " + String.format("%.2f", amount)
                        + (cashback > 0 ? " earned INR " + String.format("%.2f", cashback) + " cashback." : " completed."),
                "SUCCESS");

        return new BillPaymentResult(tx, user, pointsAwarded, cashback);
    }

    private String buildDescription(String billType, String provider, String accountNumber,
                                    String description, double cashback) {
        String base = billType + " payment to " + provider.trim() + " for " + accountNumber.trim();
        if (cashback > 0) {
            base += " | Cashback INR " + String.format("%.2f", cashback);
        }
        if (description == null || description.isBlank()) {
            return base;
        }
        return base + " | " + description.trim();
    }

    public static class BillPaymentResult {
        private final Transaction transaction;
        private final User user;
        private final int pointsAwarded;
        private final double cashback;

        public BillPaymentResult(Transaction transaction, User user, int pointsAwarded, double cashback) {
            this.transaction = transaction;
            this.user = user;
            this.pointsAwarded = pointsAwarded;
            this.cashback = cashback;
        }

        public Transaction getTransaction() { return transaction; }
        public User getUser() { return user; }
        public int getPointsAwarded() { return pointsAwarded; }
        public double getCashback() { return cashback; }
    }
}
