package payment_system_backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import payment_system_backend.model.Reward;
import payment_system_backend.repository.RewardRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class RewardService {

    @Autowired
    private RewardRepository rewardRepository;

    private static final int DAILY_BONUS_POINTS = 50;

    public double calculateCashback(double amount, String category) {
        String normalized = category == null ? "" : category.toUpperCase();
        if (amount >= 500 && (normalized.contains("ELECTRICITY") || normalized.contains("DTH"))) {
            return roundMoney(Math.min(75, amount * 0.05));
        }
        if (amount >= 199 && (normalized.contains("RECHARGE") || normalized.contains("MOBILE"))) {
            return roundMoney(Math.min(30, amount * 0.03));
        }
        if (amount >= 1000 && normalized.contains("TRANSFER")) {
            return roundMoney(Math.min(50, amount * 0.02));
        }
        return 0;
    }

    public List<Map<String, Object>> getCashbackOffers() {
        return List.of(
                Map.of("title", "Electricity Saver", "category", "ELECTRICITY", "details", "5% cashback up to INR 75 on payments above INR 500"),
                Map.of("title", "Mobile Recharge Boost", "category", "RECHARGE", "details", "3% cashback up to INR 30 on recharges above INR 199"),
                Map.of("title", "DTH Weekend Value", "category", "DTH", "details", "5% cashback up to INR 75 on DTH payments above INR 500"),
                Map.of("title", "Large Transfer Reward", "category", "TRANSFER", "details", "2% cashback up to INR 50 on transfers above INR 1,000")
        );
    }

    /** Award points for a completed transaction. Points = floor(amount / 10), min 1. */
    public int awardTransactionPoints(Long userId, double amount) {
        int points = Math.max(1, (int) Math.floor(amount / 10));
        Reward reward = new Reward();
        reward.setUserId(userId);
        reward.setPoints(points);
        reward.setSource("TRANSACTION");
        reward.setDate(LocalDate.now());
        rewardRepository.save(reward);
        return points;
    }

    /** Award referral bonus points. Source is REFERRAL_GIVEN or REFERRAL_CLAIMED. */
    public int awardReferralPoints(Long userId, int points, String source) {
        Reward reward = new Reward();
        reward.setUserId(userId);
        reward.setPoints(points);
        reward.setSource(source);
        reward.setDate(LocalDate.now());
        rewardRepository.save(reward);
        return points;
    }

    /**
     * Claim daily login bonus. Returns points awarded (50) or 0 if already claimed today.
     */
    public int claimDailyBonus(Long userId) {
        LocalDate today = LocalDate.now();
        Optional<Reward> existing = rewardRepository.findByUserIdAndSourceAndDate(userId, "DAILY_BONUS", today);
        if (existing.isPresent()) {
            return 0; // already claimed
        }
        Reward reward = new Reward();
        reward.setUserId(userId);
        reward.setPoints(DAILY_BONUS_POINTS);
        reward.setSource("DAILY_BONUS");
        reward.setDate(today);
        rewardRepository.save(reward);
        return DAILY_BONUS_POINTS;
    }

    /** Get total accumulated points for a user. */
    public int getTotalPoints(Long userId) {
        return rewardRepository.sumPointsByUserId(userId);
    }

    /** Get reward history for a user (newest first). */
    public List<Reward> getHistory(Long userId) {
        return rewardRepository.findByUserIdOrderByDateDesc(userId);
    }

    private double roundMoney(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
