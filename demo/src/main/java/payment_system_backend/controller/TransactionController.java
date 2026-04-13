package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.model.Transaction;
import payment_system_backend.repository.TransactionRepository;
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
    private RewardService rewardService;

    @Autowired
    private FraudDetectionService fraudDetectionService;

    // ─── Send Money ───────────────────────────────────────────────────────────

    @PostMapping("/send")
    public ResponseEntity<Map<String, Object>> sendMoney(
            @RequestParam("senderId") Long senderId,
            @RequestParam("receiverId") Long receiverId,
            @RequestParam("amount") double amount,
            @RequestParam(value = "description", required = false) String description) {
        try {
            Transaction tx = transactionService.sendMoney(senderId, receiverId, amount, description);

            int pointsAwarded = rewardService.awardTransactionPoints(senderId, amount);

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Payment Successful");
            response.put("transactionId", tx.getId());
            response.put("riskScore", tx.getRiskScore());
            response.put("riskLevel", tx.getRiskLevel());
            response.put("pointsAwarded", pointsAwarded);
            response.put("totalPoints", rewardService.getTotalPoints(senderId));
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
            @RequestParam double amount) {
        try {
            var sender = transactionRepo.findBySenderId(senderId); // just to get account age
            // We call the repo directly for account age
            FraudDetectionService.RiskAssessment risk =
                fraudDetectionService.assess(senderId, amount, 0);

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
    public List<Transaction> history(@PathVariable("userId") Long userId) {
        List<Transaction> all = new ArrayList<>();
        all.addAll(transactionRepo.findBySenderId(userId));
        all.addAll(transactionRepo.findByReceiverId(userId));
        all.sort(Comparator.comparing(Transaction::getTime,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return all;
    }

    // ─── Refund ───────────────────────────────────────────────────────────────

    @PostMapping("/refund/{txId}")
    public ResponseEntity<?> requestRefund(@PathVariable Long txId,
                                            @RequestParam Long userId) {
        try {
            Transaction tx = transactionService.requestRefund(txId, userId);
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
}