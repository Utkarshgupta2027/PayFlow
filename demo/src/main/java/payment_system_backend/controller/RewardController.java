package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.model.Reward;
import payment_system_backend.service.RewardService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/rewards")
public class RewardController {

    @Autowired
    private RewardService rewardService;

    /** Get total points + history for a user */
    @GetMapping("/{userId}")
    public ResponseEntity<Map<String, Object>> getRewards(@PathVariable Long userId) {
        int totalPoints = rewardService.getTotalPoints(userId);
        List<Reward> history = rewardService.getHistory(userId);

        Map<String, Object> response = new HashMap<>();
        response.put("totalPoints", totalPoints);
        response.put("history", history);

        // Tier calculation
        String tier;
        if (totalPoints >= 5000) tier = "PLATINUM";
        else if (totalPoints >= 2000) tier = "GOLD";
        else if (totalPoints >= 500) tier = "SILVER";
        else tier = "BRONZE";
        response.put("tier", tier);

        return ResponseEntity.ok(response);
    }

    /** Claim daily login bonus */
    @PostMapping("/daily-bonus/{userId}")
    public ResponseEntity<Map<String, Object>> claimDailyBonus(@PathVariable Long userId) {
        int awarded = rewardService.claimDailyBonus(userId);
        Map<String, Object> response = new HashMap<>();
        response.put("pointsAwarded", awarded);
        response.put("alreadyClaimed", awarded == 0);
        response.put("totalPoints", rewardService.getTotalPoints(userId));
        return ResponseEntity.ok(response);
    }
}
