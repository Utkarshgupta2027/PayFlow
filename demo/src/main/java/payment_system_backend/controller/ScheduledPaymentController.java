package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.model.ScheduledPayment;
import payment_system_backend.model.User;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.service.ScheduledPaymentService;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/scheduled-payments")
public class ScheduledPaymentController {

    @Autowired
    private ScheduledPaymentService scheduledPaymentService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @GetMapping
    public List<ScheduledPayment> list(Authentication authentication) {
        User user = currentUser(authentication);
        return scheduledPaymentService.listForUser(user.getId());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateScheduleRequest request,
                                    Authentication authentication) {
        try {
            User user = currentUser(authentication);
            verifyOrCreatePermanentPin(user, request.transactionPin, request.newTransactionPin);

            ScheduledPayment schedule = scheduledPaymentService.create(
                    user.getId(),
                    request.receiverId,
                    request.amount,
                    request.title,
                    request.description,
                    request.frequency,
                    request.dayOfMonth,
                    request.dayOfWeek,
                    request.startDate
            );
            return ResponseEntity.ok(schedule);
        } catch (RuntimeException ex) {
            int status = ex.getMessage() != null && ex.getMessage().contains("PIN") ? 403 : 400;
            return ResponseEntity.status(status).body(Map.of("error", ex.getMessage()));
        }
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long id,
                                          @RequestBody Map<String, String> body,
                                          Authentication authentication) {
        try {
            User user = currentUser(authentication);
            return ResponseEntity.ok(scheduledPaymentService.updateStatus(id, user.getId(), body.get("status")));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, Authentication authentication) {
        try {
            User user = currentUser(authentication);
            scheduledPaymentService.delete(id, user.getId());
            return ResponseEntity.ok(Map.of("message", "Scheduled payment deleted"));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    private void verifyOrCreatePermanentPin(User user, String transactionPin, String newTransactionPin) {
        if (user.getTransactionPin() == null) {
            if (newTransactionPin == null || !newTransactionPin.matches("\\d{4,6}")) {
                throw new RuntimeException("Set a 4-6 digit Transaction PIN to start auto-pay.");
            }
            user.setTransactionPin(passwordEncoder.encode(newTransactionPin));
            userRepository.save(user);
            return;
        }
        if (transactionPin == null || transactionPin.isBlank()) {
            throw new RuntimeException("Transaction PIN is required.");
        }
        if (!passwordEncoder.matches(transactionPin, user.getTransactionPin())) {
            throw new RuntimeException("Incorrect Transaction PIN.");
        }
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

    public static class CreateScheduleRequest {
        public Long receiverId;
        public double amount;
        public String title;
        public String description;
        public String frequency;
        public Integer dayOfMonth;
        public Integer dayOfWeek;
        public LocalDate startDate;
        public String transactionPin;
        public String newTransactionPin;
    }
}
