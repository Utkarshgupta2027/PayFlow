package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.model.User;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.service.RewardService;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/referral")
public class ReferralController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RewardService rewardService;

    private static final int REFERRER_BONUS   = 100;
    private static final int REFEREE_BONUS    = 50;

    /** Generate a unique referral code for a user if they don't have one */
    private String ensureReferralCode(User user) {
        if (user.getReferralCode() != null && !user.getReferralCode().isEmpty()) {
            return user.getReferralCode();
        }
        // Generate unique 8-char code from UUID
        String code;
        do {
            code = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        } while (userRepository.findByReferralCode(code) != null);
        user.setReferralCode(code);
        userRepository.save(user);
        return code;
    }

    /**
     * GET /referral/code/{userId}
     * Returns the referral code. Auto-generates one if the user doesn't have one yet
     * (for accounts created before the referral feature was added).
     */
    @GetMapping("/code/{userId}")
    public ResponseEntity<?> getReferralCode(@PathVariable Long userId) {
        return userRepository.findById(userId)
            .map(user -> {
                String code = ensureReferralCode(user); // auto-generate if missing
                Map<String, Object> res = new HashMap<>();
                res.put("referralCode", code);
                res.put("name", user.getName());
                res.put("userId", user.getId());
                res.put("referredBy", user.getReferredBy());
                return ResponseEntity.ok(res);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /referral/claim?userId={userId}&code={referralCode}
     * Claim a referral reward using someone else's referral code.
     * Awards REFERRER_BONUS to the referrer and REFEREE_BONUS to this user.
     * Can only be claimed once per user.
     */
    @PostMapping("/claim")
    public ResponseEntity<?> claimReferral(
            @RequestParam Long userId,
            @RequestParam String code) {

        User claimer = userRepository.findById(userId).orElse(null);
        if (claimer == null) {
            return ResponseEntity.badRequest().body("User not found.");
        }

        // Check already used a referral code before
        if (claimer.getReferredBy() != null) {
            Map<String, Object> res = new HashMap<>();
            res.put("success", false);
            res.put("message", "You have already claimed a referral bonus.");
            return ResponseEntity.ok(res);
        }

        // Can't use your own code
        if (code.equalsIgnoreCase(claimer.getReferralCode())) {
            return ResponseEntity.badRequest().body("You cannot use your own referral code.");
        }

        // Find referrer
        User referrer = userRepository.findByReferralCode(code.toUpperCase());
        if (referrer == null) {
            return ResponseEntity.badRequest().body("Invalid referral code. Please check and try again.");
        }

        // Award points to referrer
        rewardService.awardReferralPoints(referrer.getId(), REFERRER_BONUS, "REFERRAL_GIVEN");

        // Award points to claimer and mark code as used
        rewardService.awardReferralPoints(claimer.getId(), REFEREE_BONUS, "REFERRAL_CLAIMED");
        claimer.setReferredBy(code.toUpperCase());
        userRepository.save(claimer);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("refereeName", referrer.getName());
        res.put("pointsEarned", REFEREE_BONUS);
        res.put("referrerBonus", REFERRER_BONUS);
        res.put("message", "Referral claimed! You earned " + REFEREE_BONUS + " points.");
        return ResponseEntity.ok(res);
    }
}
