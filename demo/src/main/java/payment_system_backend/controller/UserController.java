package payment_system_backend.controller;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import payment_system_backend.dto.LoginRequest;
import payment_system_backend.model.User;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.security.JwtUtil;
import payment_system_backend.service.UserService;

@RestController
@RequestMapping("/user")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody User user) {
        try {
            validateRegistrationPayload(user);
            User saved = userService.registerUser(user);
            Map<String, Object> response = buildAuthResponse(saved, saved.getEmail());
            return ResponseEntity.ok(response);
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            User user = userRepository.findByEmail(request.getEmail());

            if (user == null || !passwordMatches(request.getPassword(), user)) {
                return ResponseEntity.status(401).body("Invalid email or password. Please try again.");
            }

            // Frozen account check
            if (user.isFrozen()) {
                return ResponseEntity.status(403).body(
                        "Your account has been frozen due to suspicious activity. Please contact support.");
            }

            // Update last login timestamp
            user.setLastLoginAt(LocalDateTime.now());
            userRepository.save(user);

            String token = jwtUtil.generateToken(user.getEmail());
            String refreshToken = jwtUtil.generateRefreshToken(user.getEmail());

            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("refreshToken", refreshToken);
            response.put("user", user);

            return ResponseEntity.ok(response);
        } catch (Exception ex) {
            return ResponseEntity.status(500).body("Login failed. Please try again.");
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        String email = jwtUtil.validateRefreshToken(refreshToken);
        if (email == null) {
            return ResponseEntity.status(401).body("Invalid or expired refresh token");
        }
        String newToken = jwtUtil.generateToken(email);
        return ResponseEntity.ok(Map.of("token", newToken));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getUserById(@PathVariable("id") Long id) {
        return userRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable("id") Long id) {

        return userRepository.findById(id)
                .map(user -> {
                    userRepository.delete(user);
                    return ResponseEntity.ok().body("User deleted successfully");
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/pin-status")
    public ResponseEntity<?> pinStatus(Authentication authentication) {
        try {
            User user = currentUser(authentication);
            return ResponseEntity.ok(Map.of("pinSet", user.getTransactionPin() != null));
        } catch (RuntimeException ex) {
            return ResponseEntity.status(401).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/set-pin")
    public ResponseEntity<?> setTransactionPin(@RequestBody Map<String, String> body,
                                               Authentication authentication) {
        try {
            User user = currentUser(authentication);
            String currentPin = body.get("currentPin");
            String newPin = body.get("newPin");

            if (newPin == null || !newPin.matches("\\d{4,6}")) {
                throw new RuntimeException("PIN must be 4-6 digits.");
            }

            if (user.getTransactionPin() != null) {
                if (currentPin == null || currentPin.isBlank()) {
                    throw new RuntimeException("Current PIN is required.");
                }
                if (!passwordEncoder.matches(currentPin, user.getTransactionPin())) {
                    throw new RuntimeException("Current PIN is incorrect.");
                }
            }

            user.setTransactionPin(passwordEncoder.encode(newPin));
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("message", "Transaction PIN saved successfully", "pinSet", true));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    private boolean passwordMatches(String rawPassword, User user) {
        String stored = user.getPassword();
        if (stored == null) return false;
        if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
            return passwordEncoder.matches(rawPassword, stored);
        }
        boolean legacyMatch = stored.equals(rawPassword);
        if (legacyMatch) {
            user.setPassword(passwordEncoder.encode(rawPassword));
            userRepository.save(user);
        }
        return legacyMatch;
    }

    /**
     * Promote a user to ADMIN. First registered user is already auto-admin;
     * further promotions require an existing admin JWT.
     */
    @PostMapping("/make-admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> makeAdmin(
            @RequestParam String email) {
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

    private void validateRegistrationPayload(User user) {
        if (user == null) {
            throw new RuntimeException("Registration payload is required.");
        }
        if (user.getName() == null || user.getName().isBlank()) {
            throw new RuntimeException("Name is required for registration.");
        }
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            throw new RuntimeException("Email is required for registration.");
        }
        if (user.getPassword() == null || user.getPassword().isBlank()) {
            throw new RuntimeException("Password is required for registration.");
        }
    }

    private Map<String, Object> buildAuthResponse(User user, String subject) {
        String token = jwtUtil.generateToken(subject);
        String refreshToken = jwtUtil.generateRefreshToken(subject);
        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("refreshToken", refreshToken);
        response.put("user", user);
        return response;
    }

    private User currentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Authentication required");
        }
        User user = userRepository.findByEmail(authentication.getName());
        if (user == null) {
            user = userRepository.findByPhoneNumber(authentication.getName());
        }
        if (user == null) {
            throw new RuntimeException("Authenticated user not found");
        }
        return user;
    }
}
