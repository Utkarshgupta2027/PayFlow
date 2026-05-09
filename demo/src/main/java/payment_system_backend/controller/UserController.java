package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.dto.LoginRequest;
import payment_system_backend.model.User;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.security.JwtUtil;
import payment_system_backend.service.UserService;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/user")
public class UserController {

    @Autowired private UserService      userService;
    @Autowired private UserRepository   userRepository;
    @Autowired private JwtUtil          jwtUtil;
    @Autowired private PasswordEncoder  passwordEncoder;

    /* ─── Email + Password Register ──────────────────────────────────────── */
    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody User user) {
        try {
            validateEmailRegistration(user);
            User saved = userService.registerUser(user);
            return ResponseEntity.ok(buildAuthResponse(saved, saved.getEmail()));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    /* ─── Phone + Password Register ──────────────────────────────────────── */
    @PostMapping("/register-phone")
    public ResponseEntity<?> registerPhoneUser(@RequestBody User user) {
        try {
            validatePhoneRegistration(user);
            User saved = userService.registerPhoneUser(user);
            // JWT subject = phone number for phone-based users
            return ResponseEntity.ok(buildAuthResponse(saved, saved.getPhoneNumber()));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    /* ─── Login (email OR phone + password) ─────────────────────────────── */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            User user = resolveUser(request);

            if (user == null || !passwordMatches(request.getPassword(), user)) {
                return ResponseEntity.status(401).body("Invalid credentials. Please try again.");
            }

            if (user.isFrozen()) {
                return ResponseEntity.status(403).body(
                        "Your account has been frozen due to suspicious activity. Please contact support.");
            }

            user.setLastLoginAt(LocalDateTime.now());
            userRepository.save(user);

            // Subject is phone for phone-users, email for email-users
            String subject = (user.getEmail() != null && !user.getEmail().isBlank())
                    ? user.getEmail()
                    : user.getPhoneNumber();

            return ResponseEntity.ok(buildAuthResponse(user, subject));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body("Login failed. Please try again.");
        }
    }

    /* ─── Token Refresh ─────────────────────────────────────────────────── */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        String subject = jwtUtil.validateRefreshToken(refreshToken);
        if (subject == null) {
            return ResponseEntity.status(401).body("Invalid or expired refresh token");
        }
        return ResponseEntity.ok(Map.of("token", jwtUtil.generateToken(subject)));
    }

    /* ─── Get user by ID ────────────────────────────────────────────────── */
    @GetMapping("/{id}")
    public ResponseEntity<?> getUserById(@PathVariable("id") Long id) {
        return userRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /* ─── Delete user ───────────────────────────────────────────────────── */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable("id") Long id) {
        return userRepository.findById(id)
                .map(user -> {
                    userRepository.delete(user);
                    return ResponseEntity.ok().body("User deleted successfully");
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /* ─── Promote to ADMIN ──────────────────────────────────────────────── */
    @PostMapping("/make-admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> makeAdmin(@RequestParam String email) {
        User user = userRepository.findByEmail(email);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found: " + email));
        }
        user.setRole("ADMIN");
        userRepository.save(user);
        return ResponseEntity.ok(Map.of(
                "message", "User promoted to ADMIN successfully",
                "email", email,
                "role", "ADMIN"));
    }

    /* ─── Set / Change Transaction PIN ──────────────────────────────────── */
    @PostMapping("/set-pin")
    public ResponseEntity<?> setTransactionPin(
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        try {
            User user = resolveFromAuth(authentication);
            String newPin = body.get("newPin");
            String currentPin = body.get("currentPin");

            if (newPin == null || !newPin.matches("^\\d{4,6}$")) {
                return ResponseEntity.badRequest().body(
                        Map.of("error", "PIN must be 4-6 digits."));
            }

            // If a PIN is already set, the current PIN is required
            if (user.getTransactionPin() != null) {
                if (currentPin == null || !passwordEncoder.matches(currentPin, user.getTransactionPin())) {
                    return ResponseEntity.status(403).body(
                            Map.of("error", "Current PIN is incorrect."));
                }
            }

            user.setTransactionPin(passwordEncoder.encode(newPin));
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("message", "Transaction PIN updated successfully."));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to update PIN."));
        }
    }

    /* ─── Verify Transaction PIN (pre-flight check) ─────────────────────── */
    @PostMapping("/verify-pin")
    public ResponseEntity<?> verifyTransactionPin(
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        try {
            User user = resolveFromAuth(authentication);
            String pin = body.get("pin");

            if (user.getTransactionPin() == null) {
                return ResponseEntity.ok(Map.of("valid", true, "message", "No PIN set — open."));
            }
            if (pin == null || !passwordEncoder.matches(pin, user.getTransactionPin())) {
                return ResponseEntity.status(403).body(Map.of("valid", false, "error", "Incorrect PIN."));
            }
            return ResponseEntity.ok(Map.of("valid", true));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", "PIN verification failed."));
        }
    }

    /* ─── PIN status (does user have a PIN set?) ─────────────────────────── */
    @GetMapping("/pin-status")
    public ResponseEntity<?> pinStatus(Authentication authentication) {
        try {
            User user = resolveFromAuth(authentication);
            return ResponseEntity.ok(Map.of("pinSet", user.getTransactionPin() != null));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", "Could not fetch PIN status."));
        }
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * Try to find the user by email first; fall back to phone number.
     * This allows a single /login endpoint to serve both auth methods.
     */
    private User resolveUser(LoginRequest req) {
        // Try email
        if (req.getEmail() != null && !req.getEmail().isBlank()) {
            return userRepository.findByEmail(req.getEmail().trim());
        }
        // Try phone
        if (req.getPhoneNumber() != null && !req.getPhoneNumber().isBlank()) {
            return userRepository.findByPhoneNumber(req.getPhoneNumber().trim());
        }
        return null;
    }

    private boolean passwordMatches(String rawPassword, User user) {
        String stored = user.getPassword();
        if (stored == null || rawPassword == null) return false;
        if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
            return passwordEncoder.matches(rawPassword, stored);
        }
        // Legacy plain-text upgrade
        boolean legacyMatch = stored.equals(rawPassword);
        if (legacyMatch) {
            user.setPassword(passwordEncoder.encode(rawPassword));
            userRepository.save(user);
        }
        return legacyMatch;
    }

    private void validateEmailRegistration(User user) {
        if (user == null) throw new RuntimeException("Registration payload is required.");
        if (user.getName() == null || user.getName().isBlank())
            throw new RuntimeException("Name is required.");
        if (user.getEmail() == null || user.getEmail().isBlank())
            throw new RuntimeException("Email is required.");
        if (user.getPassword() == null || user.getPassword().isBlank())
            throw new RuntimeException("Password is required.");
    }

    private void validatePhoneRegistration(User user) {
        if (user == null) throw new RuntimeException("Registration payload is required.");
        if (user.getName() == null || user.getName().isBlank())
            throw new RuntimeException("Name is required.");
        if (user.getPhoneNumber() == null || user.getPhoneNumber().isBlank())
            throw new RuntimeException("Phone number is required.");
        if (user.getPassword() == null || user.getPassword().isBlank())
            throw new RuntimeException("Password is required.");
    }

    /**
     * Resolve the authenticated user from a JWT subject (email or phone).
     */
    private User resolveFromAuth(Authentication authentication) {
        if (authentication == null || authentication.getName() == null)
            throw new RuntimeException("Authentication required");
        String subject = authentication.getName();
        User user = userRepository.findByEmail(subject);
        if (user == null) user = userRepository.findByPhoneNumber(subject);
        if (user == null) throw new RuntimeException("Authenticated user not found");
        return user;
    }

    private Map<String, Object> buildAuthResponse(User user, String subject) {
        Map<String, Object> response = new HashMap<>();
        response.put("token", jwtUtil.generateToken(subject));
        response.put("refreshToken", jwtUtil.generateRefreshToken(subject));
        response.put("user", user);
        return response;
    }
}
