package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.service.OtpService;

import java.util.Map;

@RestController
@RequestMapping("/api/email-otp")
public class EmailOtpController {

    @Autowired
    private OtpService otpService;

    @PostMapping("/send")
    public ResponseEntity<?> sendEmailOtp(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        }

        try {
            otpService.sendEmailOtp(email);
            return ResponseEntity.ok(Map.of("message", "OTP sent successfully to " + email));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "error", "Failed to send OTP",
                "details", e.getMessage()
            ));
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verifyEmailOtp(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String otp = body.get("otp");

        if (email == null || email.isBlank() || otp == null || otp.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and OTP are required"));
        }

        boolean isValid = otpService.verifyOtp(email, otp);
        if (isValid) {
            return ResponseEntity.ok(Map.of("message", "Email verified successfully", "verified", true));
        } else {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid or expired OTP", "verified", false));
        }
    }
}
