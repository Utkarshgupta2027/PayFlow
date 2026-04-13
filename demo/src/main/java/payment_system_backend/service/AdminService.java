package payment_system_backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import payment_system_backend.model.User;
import payment_system_backend.model.Transaction;
import payment_system_backend.repository.TransactionRepository;
import payment_system_backend.repository.UserRepository;

import java.util.*;

@Service
public class AdminService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private TransactionService transactionService;

    @Autowired
    private NotificationService notificationService;

    // ─── User Management ─────────────────────────────────────────────────────

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public User blockUser(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() ->
                new RuntimeException("User not found"));
        user.setFrozen(true);
        userRepository.save(user);

        notificationService.createNotification(userId,
                "🔒 Account Suspended",
                "Your account has been suspended by an administrator. Please contact support.",
                "ALERT");

        return user;
    }

    public User unblockUser(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() ->
                new RuntimeException("User not found"));
        user.setFrozen(false);
        userRepository.save(user);

        notificationService.createNotification(userId,
                "🔓 Account Restored",
                "Your account has been restored. You can now make transactions.",
                "SUCCESS");

        return user;
    }

    // ─── Refund Management ───────────────────────────────────────────────────

    public List<Transaction> getPendingRefunds() {
        return transactionRepository.findByRefundStatus("PENDING");
    }

    public Transaction approveRefund(Long transactionId) {
        return transactionService.approveRefund(transactionId);
    }

    public Transaction rejectRefund(Long transactionId) {
        return transactionService.rejectRefund(transactionId);
    }

    // ─── Dashboard Stats ─────────────────────────────────────────────────────

    public Map<String, Object> getDashboardStats() {
        List<User> allUsers = userRepository.findAll();
        List<Transaction> allTxns = transactionRepository.findAll();

        long totalUsers = allUsers.size();
        long frozenUsers = allUsers.stream().filter(User::isFrozen).count();
        long totalTxns = allTxns.size();
        double totalVolume = allTxns.stream().mapToDouble(Transaction::getAmount).sum();
        long flaggedTxns = allTxns.stream()
                .filter(t -> "FLAGGED".equals(t.getStatus()) || "HIGH".equals(t.getRiskLevel()))
                .count();
        long pendingRefunds = allTxns.stream()
                .filter(t -> "PENDING".equals(t.getRefundStatus()))
                .count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalUsers", totalUsers);
        stats.put("frozenUsers", frozenUsers);
        stats.put("totalTransactions", totalTxns);
        stats.put("totalVolume", totalVolume);
        stats.put("flaggedTransactions", flaggedTxns);
        stats.put("pendingRefunds", pendingRefunds);
        return stats;
    }
}
