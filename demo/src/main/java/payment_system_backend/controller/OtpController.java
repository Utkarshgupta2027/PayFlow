package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.dto.OtpRequest;
import payment_system_backend.model.User;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.security.JwtUtil;
import payment_system_backend.service.OtpService;
import payment_system_backend.service.UserService;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/otp")
public class OtpController {

    @Autowired
    private OtpService otpService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private JwtUtil jwtUtil;

    /**
     * POST /otp/send
     * Body: { "phoneNumber": "+91XXXXXXXXXX" }
     * Sends an OTP SMS to the provided number.
     */
    @PostMapping("/send")
    public ResponseEntity<?> sendOtp(@RequestBody OtpRequest request) {
        if (request.getPhoneNumber() == null || request.getPhoneNumber().isBlank()) {
            return ResponseEntity.badRequest().body("Phone number is required.");
        }
        try {
            otpService.sendOtp(request.getPhoneNumber());
            return ResponseEntity.ok("OTP sent successfully.");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Failed to send OTP. Please try again.");
        }
    }

    /**
     * POST /otp/register
     * Body: { "name", "phoneNumber", "otp" }
     * Verifies OTP then registers the user — delegates to UserService so that
     * referral code generation and first-user ADMIN assignment work correctly.
     */
    @PostMapping("/register")
    public ResponseEntity<?> registerWithOtp(@RequestBody OtpRequest request) {
        if (!otpService.verifyOtp(request.getPhoneNumber(), request.getOtp())) {
            return ResponseEntity.status(400).body("Invalid or expired OTP. Please try again.");
        }

        // Check if phone already registered
        if (userRepository.findByPhoneNumber(request.getPhoneNumber()) != null) {
            return ResponseEntity.status(400).body("This phone number is already registered.");
        }

        User user = new User();
        user.setName(request.getName());
        user.setPhoneNumber(request.getPhoneNumber());
        // No password required for phone-OTP users
        user.setBalance(0);

        try {
            User saved = userService.registerPhoneUser(user);

            // Auto-login: generate tokens immediately after registration
            String subject = saved.getPhoneNumber();
            String token = jwtUtil.generateToken(subject);
            String refreshToken = jwtUtil.generateRefreshToken(subject);

            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("refreshToken", refreshToken);
            response.put("user", saved);
            return ResponseEntity.ok(response);
        } catch (RuntimeException ex) {
            return ResponseEntity.status(400).body(ex.getMessage());
        }
    }

    /**
     * POST /otp/login
     * Body: { "phoneNumber", "otp" }
     * Verifies OTP then returns JWT + refreshToken + user object.
     */
    @PostMapping("/login")
    public ResponseEntity<?> loginWithOtp(@RequestBody OtpRequest request) {
        if (!otpService.verifyOtp(request.getPhoneNumber(), request.getOtp())) {
            return ResponseEntity.status(401).body("Invalid or expired OTP. Please try again.");
        }

        User user = userRepository.findByPhoneNumber(request.getPhoneNumber());
        if (user == null) {
            return ResponseEntity.status(404).body("No account found for this phone number. Please register first.");
        }

        // Frozen account check
        if (user.isFrozen()) {
            return ResponseEntity.status(403).body(
                    "Your account has been frozen due to suspicious activity. Please contact support.");
        }

        // Update last login timestamp
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        String subject = user.getPhoneNumber();
        String token = jwtUtil.generateToken(subject);
        String refreshToken = jwtUtil.generateRefreshToken(subject);

        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("refreshToken", refreshToken);
        response.put("user", user);
        return ResponseEntity.ok(response);
    }
}
