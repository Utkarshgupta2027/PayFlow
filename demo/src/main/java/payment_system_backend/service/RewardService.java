package payment_system_backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import payment_system_backend.model.Reward;
import payment_system_backend.repository.RewardRepository;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class RewardService {

    @Autowired
    private RewardRepository rewardRepository;

    private static final int DAILY_BONUS_POINTS = 50;

    public Map<String, Object> getLoyaltyTier(int totalPoints) {
        String name;
        int minPoints;
        Integer nextAt;
        int multiplier;
        List<String> benefits;

        if (totalPoints >= 5000) {
            name = "PLATINUM";
            minPoints = 5000;
            nextAt = null;
            multiplier = 4;
            benefits = List.of("4x reward accelerator", "Highest cashback priority", "Priority support", "Early access to new offers");
        } else if (totalPoints >= 2000) {
            name = "GOLD";
            minPoints = 2000;
            nextAt = 5000;
            multiplier = 3;
            benefits = List.of("3x reward accelerator", "Higher cashback priority", "Faster support");
        } else if (totalPoints >= 500) {
            name = "SILVER";
            minPoints = 500;
            nextAt = 2000;
            multiplier = 2;
            benefits = List.of("2x reward accelerator", "Extra cashback visibility", "Monthly offer boosts");
        } else {
            name = "BRONZE";
            minPoints = 0;
            nextAt = 500;
            multiplier = 1;
            benefits = List.of("Base rewards on every payment", "Daily bonus eligibility");
        }

        Map<String, Object> tier = new LinkedHashMap<>();
        tier.put("name", name);
        tier.put("minPoints", minPoints);
        tier.put("nextAt", nextAt);
        tier.put("pointsToNext", nextAt == null ? 0 : Math.max(0, nextAt - totalPoints));
        tier.put("progressPercent", nextAt == null ? 100 : Math.min(100, Math.round(((totalPoints - minPoints) * 100.0) / (nextAt - minPoints))));
        tier.put("rewardMultiplier", multiplier);
        tier.put("benefits", benefits);
        return tier;
    }

    public List<Map<String, Object>> getLoyaltyTiers() {
        return List.of(
                Map.of("name", "SILVER", "minPoints", 500, "rewardMultiplier", 2, "benefits", List.of("2x reward accelerator", "Monthly offer boosts")),
                Map.of("name", "GOLD", "minPoints", 2000, "rewardMultiplier", 3, "benefits", List.of("3x reward accelerator", "Higher cashback priority")),
                Map.of("name", "PLATINUM", "minPoints", 5000, "rewardMultiplier", 4, "benefits", List.of("4x reward accelerator", "Priority support"))
        );
    }

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
        int currentPoints = getTotalPoints(userId);
        int multiplier = ((Number) getLoyaltyTier(currentPoints).get("rewardMultiplier")).intValue();
        int points = Math.max(1, (int) Math.floor(amount / 10)) * multiplier;
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
