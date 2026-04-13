package payment_system_backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import payment_system_backend.model.Transaction;
import payment_system_backend.repository.TransactionRepository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Rule-based fraud detection engine.
 *
 * Scoring rules:
 *  +40 — Velocity: > 5 transactions in the last 10 minutes
 *  +30 — Large amount: > ₹20,000
 *  +50 — New account large transfer: accountAgeDays < 3 && amount > 5,000
 *  +10 — Suspicious round number: amount % 1000 == 0 && amount > 10,000
 *
 * Actions:
 *  score >= 70 → BLOCKED (account frozen)
 *  score >= 40 → FLAGGED (allowed but marked + admin notified)
 *  score < 40  → LOW (normal)
 */
@Service
public class FraudDetectionService {

    @Autowired
    private TransactionRepository transactionRepository;

    public static class RiskAssessment {
        public final double score;
        public final String level;   // LOW | MEDIUM | HIGH
        public final boolean blocked;
        public final String reason;

        public RiskAssessment(double score, String level, boolean blocked, String reason) {
            this.score = score;
            this.level = level;
            this.blocked = blocked;
            this.reason = reason;
        }
    }

    public RiskAssessment assess(Long senderId, double amount, int accountAgeDays) {
        double score = 0;
        StringBuilder reason = new StringBuilder();

        // Rule 1: Velocity check — more than 5 txns in last 10 minutes
        LocalDateTime tenMinutesAgo = LocalDateTime.now().minusMinutes(10);
        List<Transaction> recentTxns = transactionRepository.findBySenderIdAndTimeAfter(senderId, tenMinutesAgo);
        if (recentTxns.size() >= 5) {
            score += 40;
            reason.append("High transaction velocity; ");
        }

        // Rule 2: Large amount
        if (amount > 20_000) {
            score += 30;
            reason.append("Large transfer amount; ");
        }

        // Rule 3: New account + large transfer
        if (accountAgeDays < 3 && amount > 5_000) {
            score += 50;
            reason.append("New account large transfer; ");
        }

        // Rule 4: Suspicious round number
        if (amount % 1000 == 0 && amount > 10_000) {
            score += 10;
            reason.append("Suspicious round-number amount; ");
        }

        String level;
        boolean blocked;

        if (score >= 70) {
            level = "HIGH";
            blocked = true;
        } else if (score >= 40) {
            level = "MEDIUM";
            blocked = false;
        } else {
            level = "LOW";
            blocked = false;
        }

        return new RiskAssessment(score, level, blocked,
                reason.length() > 0 ? reason.toString().trim() : "No suspicious activity");
    }
}
