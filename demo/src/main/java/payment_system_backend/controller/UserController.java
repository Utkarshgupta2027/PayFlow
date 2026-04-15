package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.dto.LoginRequest;
import payment_system_backend.model.User;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.security.JwtUtil;
import payment_system_backend.service.UserService;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/user")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody User user) {
        try {
            User saved = userService.registerUser(user);
            return ResponseEntity.ok(saved);
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            User user = userRepository.findByEmail(request.getEmail());

            if (user == null || !user.getPassword().equals(request.getPassword())) {
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

    /**
     * Bootstrap endpoint: promote any user to ADMIN by email.
     * Protected by a secret key param. Remove or restrict in production.
     * Usage: POST /user/make-admin?email=you@example.com&secret=payflow-admin-2024
     */
    @PostMapping("/make-admin")
    public ResponseEntity<?> makeAdmin(
            @RequestParam String email,
            @RequestParam String secret) {
        if (!"payflow-admin-2024".equals(secret)) {
            return ResponseEntity.status(403).body(Map.of("error", "Invalid secret key"));
        }
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
}
