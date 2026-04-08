package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.model.Transaction;
import payment_system_backend.repository.TransactionRepository;
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

    @PostMapping("/send")
    public ResponseEntity<Map<String, Object>> sendMoney(
            @RequestParam("senderId") Long senderId,
            @RequestParam("receiverId") Long receiverId,
            @RequestParam("amount") double amount) {

        transactionService.sendMoney(senderId, receiverId, amount);

        // Award reward points to the sender
        int pointsAwarded = rewardService.awardTransactionPoints(senderId, amount);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Payment Successful");
        response.put("pointsAwarded", pointsAwarded);
        response.put("totalPoints", rewardService.getTotalPoints(senderId));

        return ResponseEntity.ok(response);
    }

    /** Returns all sent + received transactions for a user, newest first */
    @GetMapping("/history/{userId}")
    public List<Transaction> history(@PathVariable("userId") Long userId) {
        List<Transaction> all = new ArrayList<>();
        all.addAll(transactionRepo.findBySenderId(userId));
        all.addAll(transactionRepo.findByReceiverId(userId));
        all.sort(Comparator.comparing(Transaction::getTime,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return all;
    }

    @PostMapping("/retry/{id}")
    public String retryPayment(@PathVariable("id") Long id) {
        transactionService.retryTransaction(id);
        return "Transaction retried";
    }

    /**
     * Analytics: aggregated spending for a user over a time period.
     * period = "day" | "week" | "month"
     * Returns list of {label, amount} objects.
     */
    @GetMapping("/analytics/{userId}")
    public ResponseEntity<Map<String, Object>> analytics(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "week") String period) {

        List<Transaction> sentTxns = transactionRepo.findBySenderId(userId);

        LocalDate today = LocalDate.now();
        Map<String, Double> grouped = new LinkedHashMap<>();

        if ("day".equals(period)) {
            // Last 24 hours, group by hour
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
            // Last 7 days, group by day of week
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
        } else { // month
            // Last 30 days, group by day of month
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

        double total = data.stream()
                .mapToDouble(m -> ((Number) m.get("amount")).doubleValue())
                .sum();

        Map<String, Object> response = new HashMap<>();
        response.put("data", data);
        response.put("total", total);
        response.put("period", period);

        return ResponseEntity.ok(response);
    }
}