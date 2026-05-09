package payment_system_backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import payment_system_backend.model.User;
import payment_system_backend.repository.UserRepository;

import java.util.UUID;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /** Register via email + password. */
    public User registerUser(User user) {
        if (userRepository.findByEmail(user.getEmail()) != null) {
            throw new RuntimeException("Email already registered. Please use a different email.");
        }

        user.setBalance(0);
        user.setPassword(passwordEncoder.encode(user.getPassword()));

        assignReferralCodeAndRole(user);
        return userRepository.save(user);
    }

    /** Register via phone number + password (no OTP required). */
    public User registerPhoneUser(User user) {
        if (userRepository.findByPhoneNumber(user.getPhoneNumber()) != null) {
            throw new RuntimeException("This phone number is already registered.");
        }

        user.setBalance(0);
        user.setPassword(passwordEncoder.encode(user.getPassword()));

        assignReferralCodeAndRole(user);
        return userRepository.save(user);
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    private void assignReferralCodeAndRole(User user) {
        // Auto-generate unique referral code
        String code;
        do {
            code = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        } while (userRepository.findByReferralCode(code) != null);
        user.setReferralCode(code);

        // First user ever gets ADMIN role
        if (userRepository.count() == 0) {
            user.setRole("ADMIN");
        } else {
            user.setRole("USER");
        }
    }
}
