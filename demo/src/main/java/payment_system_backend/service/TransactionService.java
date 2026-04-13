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
public class TransactionService {

    @Autowired
    private TransactionRepository transactionRepo;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FraudDetectionService fraudDetectionService;

    @Autowired
    private NotificationService notificationService;

    @Transactional
    public Transaction sendMoney(Long senderId, Long receiverId, double amount, String description) {

        User sender = userRepository.findById(senderId).orElseThrow(() ->
                new RuntimeException("Sender not found"));
        User receiver = userRepository.findById(receiverId).orElseThrow(() ->
                new RuntimeException("Receiver not found"));

        // ─── Frozen account check ─────────────────────────────────────────────
        if (sender.isFrozen()) {
            throw new RuntimeException("Your account has been frozen. Please contact support.");
        }

        // ─── Basic balance check ──────────────────────────────────────────────
        if (sender.getBalance() < amount) {
            throw new RuntimeException("Insufficient balance");
        }

        // ─── Fraud Detection ──────────────────────────────────────────────────
        FraudDetectionService.RiskAssessment risk =
                fraudDetectionService.assess(senderId, amount, sender.getAccountAgeDays());

        if (risk.blocked) {
            // Freeze the sender account
            sender.setFrozen(true);
            userRepository.save(sender);

            // Notify sender
            notificationService.createNotification(senderId,
                    "🚨 Account Frozen",
                    "Suspicious activity detected (" + risk.reason + "). Your account has been temporarily frozen.",
                    "ALERT");

            // Notify admin users
            userRepository.findByRole("ADMIN").forEach(admin ->
                notificationService.createNotification(admin.getId(),
                        "⚠️ Fraud Alert: " + sender.getName(),
                        "Account frozen due to: " + risk.reason + " | Amount: ₹" + amount,
                        "WARNING")
            );

            throw new RuntimeException("Transaction blocked: High fraud risk detected. Your account has been frozen.");
        }

        // ─── Execute transfer ─────────────────────────────────────────────────
        sender.setBalance(sender.getBalance() - amount);
        receiver.setBalance(receiver.getBalance() + amount);
        userRepository.save(sender);
        userRepository.save(receiver);

        // ─── Record transaction ───────────────────────────────────────────────
        Transaction tx = new Transaction();
        tx.setSenderId(senderId);
        tx.setReceiverId(receiverId);
        tx.setAmount(amount);
        tx.setStatus(risk.level.equals("MEDIUM") ? "FLAGGED" : "SUCCESS");
        tx.setTime(LocalDateTime.now());
        tx.setRiskScore(risk.score);
        tx.setRiskLevel(risk.level);
        tx.setCategory("TRANSFER");
        tx.setDescription(description);
        transactionRepo.save(tx);

        // ─── Push real-time balance updates ───────────────────────────────────
        notificationService.pushBalanceUpdate(senderId, sender.getBalance());
        notificationService.pushBalanceUpdate(receiverId, receiver.getBalance());

        // ─── In-app + email notifications ────────────────────────────────────
        String flaggedNote = risk.level.equals("MEDIUM") ? " (flagged for review)" : "";

        notificationService.createNotification(senderId,
                "✅ Payment Sent",
                "You sent ₹" + String.format("%.2f", amount) + " to " + receiver.getName() + flaggedNote,
                "SUCCESS");

        notificationService.createNotification(receiverId,
                "💰 Money Received",
                receiver.getName() + " received ₹" + String.format("%.2f", amount) + " from " + sender.getName(),
                "SUCCESS");

        notificationService.sendEmail(sender.getEmail(),
                "PayFlow — Payment Sent",
                "Hi " + sender.getName() + ",\n\nYou sent ₹" + String.format("%.2f", amount)
                        + " to " + receiver.getName() + ".\n\nTransaction ID: " + tx.getId()
                        + "\nRisk Level: " + risk.level
                        + "\n\nIf this wasn't you, contact support immediately.\n\nPayFlow Team");

        notificationService.sendEmail(receiver.getEmail(),
                "PayFlow — Money Received",
                "Hi " + receiver.getName() + ",\n\nYou received ₹" + String.format("%.2f", amount)
                        + " from " + sender.getName() + ".\n\nTransaction ID: " + tx.getId()
                        + "\n\nPayFlow Team");

        return tx;
    }

    // Convenience overload for backward compat
    @Transactional
    public Transaction sendMoney(Long senderId, Long receiverId, double amount) {
        return sendMoney(senderId, receiverId, amount, null);
    }

    @Transactional
    public void retryTransaction(Long transactionId) {
        Transaction tx = transactionRepo.findById(transactionId).orElseThrow();
        if (tx.getStatus().equals("FAILED")) {
            sendMoney(tx.getSenderId(), tx.getReceiverId(), tx.getAmount(), tx.getDescription());
        }
    }

    /**
     * User requests a refund on a completed transaction.
     */
    @Transactional
    public Transaction requestRefund(Long transactionId, Long requesterId) {
        Transaction tx = transactionRepo.findById(transactionId).orElseThrow(() ->
                new RuntimeException("Transaction not found"));

        if (!tx.getSenderId().equals(requesterId)) {
            throw new RuntimeException("You can only request a refund for your own transactions");
        }
        if (!"SUCCESS".equals(tx.getStatus()) && !"FLAGGED".equals(tx.getStatus())) {
            throw new RuntimeException("Refund can only be requested for successful transactions");
        }
        if (tx.getRefundStatus() != null) {
            throw new RuntimeException("A refund has already been requested for this transaction");
        }

        tx.setRefundStatus("PENDING");
        tx.setRefundRequestedBy(requesterId);
        transactionRepo.save(tx);

        // Notify admins
        userRepository.findByRole("ADMIN").forEach(admin ->
            notificationService.createNotification(admin.getId(),
                    "🔄 Refund Request",
                    "User " + requesterId + " requested refund for ₹"
                            + String.format("%.2f", tx.getAmount()) + " (TxID: " + tx.getId() + ")",
                    "INFO")
        );

        notificationService.createNotification(requesterId,
                "🔄 Refund Requested",
                "Your refund request of ₹" + String.format("%.2f", tx.getAmount())
                        + " is pending admin approval.",
                "INFO");

        return tx;
    }

    /**
     * Admin approves a refund — reverses the money transfer.
     */
    @Transactional
    public Transaction approveRefund(Long transactionId) {
        Transaction tx = transactionRepo.findById(transactionId).orElseThrow(() ->
                new RuntimeException("Transaction not found"));

        if (!"PENDING".equals(tx.getRefundStatus())) {
            throw new RuntimeException("No pending refund for this transaction");
        }

        // Reverse the transfer
        User sender = userRepository.findById(tx.getSenderId()).orElseThrow();
        User receiver = userRepository.findById(tx.getReceiverId()).orElseThrow();

        if (receiver.getBalance() < tx.getAmount()) {
            throw new RuntimeException("Receiver has insufficient balance for refund");
        }

        receiver.setBalance(receiver.getBalance() - tx.getAmount());
        sender.setBalance(sender.getBalance() + tx.getAmount());
        userRepository.save(sender);
        userRepository.save(receiver);

        tx.setRefundStatus("APPROVED");
        tx.setStatus("REFUNDED");
        transactionRepo.save(tx);

        // Push balance updates
        notificationService.pushBalanceUpdate(tx.getSenderId(), sender.getBalance());
        notificationService.pushBalanceUpdate(tx.getReceiverId(), receiver.getBalance());

        // Notify user
        notificationService.createNotification(tx.getSenderId(),
                "✅ Refund Approved",
                "Your refund of ₹" + String.format("%.2f", tx.getAmount()) + " has been approved and credited.",
                "SUCCESS");

        return tx;
    }

    /**
     * Admin rejects a refund request.
     */
    @Transactional
    public Transaction rejectRefund(Long transactionId) {
        Transaction tx = transactionRepo.findById(transactionId).orElseThrow(() ->
                new RuntimeException("Transaction not found"));

        if (!"PENDING".equals(tx.getRefundStatus())) {
            throw new RuntimeException("No pending refund for this transaction");
        }

        tx.setRefundStatus("REJECTED");
        transactionRepo.save(tx);

        notificationService.createNotification(tx.getSenderId(),
                "❌ Refund Rejected",
                "Your refund request of ₹" + String.format("%.2f", tx.getAmount()) + " was rejected by admin.",
                "ALERT");

        return tx;
    }
}