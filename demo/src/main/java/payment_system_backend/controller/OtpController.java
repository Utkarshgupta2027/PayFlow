package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.dto.OtpRequest;
import payment_system_backend.model.User;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.security.JwtUtil;
import payment_system_backend.service.OtpService;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/otp")
public class OtpController {

    @Autowired
    private OtpService otpService;

    @Autowired
    private UserRepository userRepository;

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
     * Body: { "name", "email", "password", "phoneNumber", "otp" }
     * Verifies OTP then registers the user with their phone number.
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

        // Check if email already registered
        if (request.getEmail() != null && !request.getEmail().isBlank()
                && userRepository.findByEmail(request.getEmail()) != null) {
            return ResponseEntity.status(400).body("Email already registered. Please use a different email.");
        }

        User user = new User();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setPassword(request.getPassword());
        user.setPhoneNumber(request.getPhoneNumber());
        user.setBalance(0);

        User saved = userRepository.save(user);
        return ResponseEntity.ok(saved);
    }

    /**
     * POST /otp/login
     * Body: { "phoneNumber", "otp" }
     * Verifies OTP then returns JWT + user object.
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

        String token = JwtUtil.generateToken(user.getEmail() != null ? user.getEmail() : user.getPhoneNumber());

        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("user", user);
        return ResponseEntity.ok(response);
    }
}
