package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.model.Transaction;
import payment_system_backend.model.User;
import payment_system_backend.repository.TransactionRepository;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.service.FraudDetectionService;
import payment_system_backend.service.RewardService;
import payment_system_backend.service.TransactionService;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/transaction")
public class TransactionController {

    @Autowired
    private TransactionService transactionService;

    @Autowired
    private TransactionRepository transactionRepo;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RewardService rewardService;

    @Autowired
    private FraudDetectionService fraudDetectionService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // ─── Send Money ───────────────────────────────────────────────────────────

    @PostMapping("/send")
    public ResponseEntity<Map<String, Object>> sendMoney(
            @RequestParam("senderId") Long senderId,
            @RequestParam("receiverId") String receiverInput,
            @RequestParam("amount") double amount,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "transactionPin", required = false) String transactionPin,
            Authentication authentication) {
        try {
            User sender = currentUser(authentication);

            // ── Transaction PIN verification ─────────────────────────────────
            if (sender.getTransactionPin() != null) {
                if (transactionPin == null || transactionPin.isBlank()) {
                    return ResponseEntity.status(403).body(
                            Map.of("error", "Transaction PIN is required."));
                }
                if (!passwordEncoder.matches(transactionPin, sender.getTransactionPin())) {
                    return ResponseEntity.status(403).body(
                            Map.of("error", "Incorrect Transaction PIN."));
                }
            }
            
            // Resolve receiver from input (ID, Email, or Phone)
            User receiver = null;
            if (receiverInput.contains("@")) {
                receiver = userRepository.findByEmail(receiverInput);
            } else {
                try {
                    Long rId = Long.parseLong(receiverInput);
                    receiver = userRepository.findById(rId).orElse(null);
                    if (receiver == null) {
                        receiver = userRepository.findByPhoneNumber(receiverInput);
                    }
                } catch (NumberFormatException e) {
                    receiver = userRepository.findByPhoneNumber(receiverInput);
                }
            }
            
            if (receiver == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Receiver not found with provided identifier."));
            }
            Long actualReceiverId = receiver.getId();

            Transaction tx = transactionService.sendMoney(sender.getId(), actualReceiverId, amount, description);

            int pointsAwarded = rewardService.awardTransactionPoints(sender.getId(), amount);
            double cashback = rewardService.calculateCashback(amount, "TRANSFER");
            if (cashback > 0) {
                User creditedSender = userRepository.findById(sender.getId()).orElse(sender);
                creditedSender.setBalance(creditedSender.getBalance() + cashback);
                userRepository.save(creditedSender);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Payment Successful");
            response.put("transactionId", tx.getId());
            response.put("riskScore", tx.getRiskScore());
            response.put("riskLevel", tx.getRiskLevel());
            response.put("pointsAwarded", pointsAwarded);
            response.put("cashback", cashback);
            response.put("totalPoints", rewardService.getTotalPoints(sender.getId()));
            return ResponseEntity.ok(response);
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    // ─── Risk Preview ─────────────────────────────────────────────────────────

    /**
     * Preview fraud risk score before sending — called by frontend as user types amount.
     */
    @GetMapping("/risk-preview")
    public ResponseEntity<Map<String, Object>> riskPreview(
            @RequestParam Long senderId,
            @RequestParam double amount,
            Authentication authentication) {
        try {
            User sender = currentUser(authentication);
            FraudDetectionService.RiskAssessment risk =
                fraudDetectionService.assess(sender.getId(), amount, sender.getAccountAgeDays());

            Map<String, Object> result = new HashMap<>();
            result.put("score", risk.score);
            result.put("level", risk.level);
            result.put("reason", risk.reason);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("score", 0, "level", "LOW", "reason", "Unknown"));
        }
    }

    // ─── History ─────────────────────────────────────────────────────────────

    @GetMapping("/history/{userId}")
    public List<Transaction> history(@PathVariable("userId") Long userId,
                                     Authentication authentication) {
        User user = currentUser(authentication);
        if (!user.getId().equals(userId) && !"ADMIN".equals(user.getRole())) {
            throw new RuntimeException("You can only view your own transaction history");
        }
        List<Transaction> all = new ArrayList<>();
        all.addAll(transactionRepo.findBySenderId(userId));
        all.addAll(transactionRepo.findByReceiverId(userId));
        all.sort(Comparator.comparing(Transaction::getTime,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return all;
    }

    @GetMapping("/search/{userId}")
    public List<Transaction> searchHistory(@PathVariable("userId") Long userId,
                                           @RequestParam(required = false) String from,
                                           @RequestParam(required = false) String to,
                                           @RequestParam(required = false) Double minAmount,
                                           @RequestParam(required = false) Double maxAmount,
                                           @RequestParam(required = false) String userQuery,
                                           Authentication authentication) {
        List<Transaction> all = history(userId, authentication);
        LocalDate fromDate = parseDate(from);
        LocalDate toDate = parseDate(to);
        String query = userQuery == null ? "" : userQuery.trim().toLowerCase();

        return all.stream()
                .filter(t -> fromDate == null || (t.getTime() != null && !t.getTime().toLocalDate().isBefore(fromDate)))
                .filter(t -> toDate == null || (t.getTime() != null && !t.getTime().toLocalDate().isAfter(toDate)))
                .filter(t -> minAmount == null || t.getAmount() >= minAmount)
                .filter(t -> maxAmount == null || t.getAmount() <= maxAmount)
                .filter(t -> query.isBlank()
                        || String.valueOf(t.getSenderId()).contains(query)
                        || String.valueOf(t.getReceiverId()).contains(query)
                        || (t.getDescription() != null && t.getDescription().toLowerCase().contains(query))
                        || (t.getCategory() != null && t.getCategory().toLowerCase().contains(query)))
                .toList();
    }

    // ─── Refund ───────────────────────────────────────────────────────────────

    @PostMapping("/refund/{txId}")
    public ResponseEntity<?> requestRefund(@PathVariable Long txId,
                                            @RequestParam Long userId,
                                            Authentication authentication) {
        try {
            User user = currentUser(authentication);
            Transaction tx = transactionService.requestRefund(txId, user.getId());
            return ResponseEntity.ok(Map.of(
                "message", "Refund requested successfully. Pending admin approval.",
                "refundStatus", tx.getRefundStatus()
            ));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    // ─── Retry ────────────────────────────────────────────────────────────────

    @PostMapping("/retry/{id}")
    public String retryPayment(@PathVariable("id") Long id) {
        transactionService.retryTransaction(id);
        return "Transaction retried";
    }

    // ─── Analytics ───────────────────────────────────────────────────────────

    @GetMapping("/analytics/{userId}")
    public ResponseEntity<Map<String, Object>> analytics(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "week") String period) {

        List<Transaction> sentTxns = transactionRepo.findBySenderId(userId);
        LocalDate today = LocalDate.now();
        Map<String, Double> grouped = new LinkedHashMap<>();

        if ("day".equals(period)) {
            LocalDateTime cutoff = LocalDateTime.now().minusHours(23);
            for (int h = 23; h >= 0; h--) {
                grouped.put(LocalDateTime.now().minusHours(h).getHour() + ":00", 0.0);
            }
            for (Transaction t : sentTxns) {
                if (t.getTime() != null && t.getTime().isAfter(cutoff)) {
                    String key = t.getTime().getHour() + ":00";
                    grouped.merge(key, t.getAmount(), Double::sum);
                }
            }
        } else if ("week".equals(period)) {
            LocalDate weekStart = today.minusDays(6);
            for (int i = 6; i >= 0; i--) {
                grouped.put(today.minusDays(i).getDayOfWeek().name().substring(0, 3), 0.0);
            }
            for (Transaction t : sentTxns) {
                if (t.getTime() != null && !t.getTime().toLocalDate().isBefore(weekStart)) {
                    String key = t.getTime().getDayOfWeek().name().substring(0, 3);
                    grouped.merge(key, t.getAmount(), Double::sum);
                }
            }
        } else {
            LocalDate monthStart = today.minusDays(29);
            for (int i = 29; i >= 0; i--) {
                grouped.put(String.valueOf(today.minusDays(i).getDayOfMonth()), 0.0);
            }
            for (Transaction t : sentTxns) {
                if (t.getTime() != null && !t.getTime().toLocalDate().isBefore(monthStart)) {
                    String key = String.valueOf(t.getTime().getDayOfMonth());
                    grouped.merge(key, t.getAmount(), Double::sum);
                }
            }
        }

        List<Map<String, Object>> data = new ArrayList<>();
        for (Map.Entry<String, Double> entry : grouped.entrySet()) {
            Map<String, Object> point = new HashMap<>();
            point.put("label", entry.getKey());
            point.put("amount", entry.getValue());
            data.add(point);
        }

        double total = data.stream().mapToDouble(m -> ((Number) m.get("amount")).doubleValue()).sum();

        // Category breakdown
        Map<String, Double> categories = new LinkedHashMap<>();
        categories.put("TRANSFER", 0.0);
        categories.put("REFUND", 0.0);
        categories.put("SPLIT", 0.0);
        for (Transaction t : sentTxns) {
            String cat = t.getCategory() != null ? t.getCategory() : "TRANSFER";
            categories.merge(cat, t.getAmount(), Double::sum);
        }

        // Monthly comparison (this month vs last month)
        LocalDate thisMonthStart = today.withDayOfMonth(1);
        LocalDate lastMonthStart = thisMonthStart.minusMonths(1);
        double thisMonthTotal = sentTxns.stream()
                .filter(t -> t.getTime() != null && !t.getTime().toLocalDate().isBefore(thisMonthStart))
                .mapToDouble(Transaction::getAmount).sum();
        double lastMonthTotal = sentTxns.stream()
                .filter(t -> t.getTime() != null
                        && !t.getTime().toLocalDate().isBefore(lastMonthStart)
                        && t.getTime().toLocalDate().isBefore(thisMonthStart))
                .mapToDouble(Transaction::getAmount).sum();

        double changePercent = lastMonthTotal > 0
                ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
                : 0;

        Map<String, Object> response = new HashMap<>();
        response.put("data", data);
        response.put("total", total);
        response.put("period", period);
        response.put("categories", categories);
        response.put("thisMonthTotal", thisMonthTotal);
        response.put("lastMonthTotal", lastMonthTotal);
        response.put("monthlyChangePercent", Math.round(changePercent * 10.0) / 10.0);

        return ResponseEntity.ok(response);
    }

    private User currentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Authentication required");
        }
        User user = userRepository.findByEmail(authentication.getName());
        if (user == null) {
            user = userRepository.findByPhoneNumber(authentication.getName());
        }
        if (user == null) {
            throw new RuntimeException("Authenticated user not found");
        }
        return user;
    }

    private LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return LocalDate.parse(value);
    }
}
