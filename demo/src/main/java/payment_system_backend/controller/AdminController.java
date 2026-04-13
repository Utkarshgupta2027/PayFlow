package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.model.Transaction;
import payment_system_backend.model.User;
import payment_system_backend.service.AdminService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    @Autowired
    private AdminService adminService;

    // ─── Dashboard ────────────────────────────────────────────────────────────

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(adminService.getDashboardStats());
    }

    // ─── User Management ─────────────────────────────────────────────────────

    @GetMapping("/users")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @PostMapping("/users/{id}/block")
    public ResponseEntity<?> blockUser(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(adminService.blockUser(id));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/users/{id}/unblock")
    public ResponseEntity<?> unblockUser(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(adminService.unblockUser(id));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    // ─── Refund Management ───────────────────────────────────────────────────

    @GetMapping("/refunds")
    public ResponseEntity<List<Transaction>> getPendingRefunds() {
        return ResponseEntity.ok(adminService.getPendingRefunds());
    }

    @PostMapping("/refunds/{txId}/approve")
    public ResponseEntity<?> approveRefund(@PathVariable Long txId) {
        try {
            return ResponseEntity.ok(adminService.approveRefund(txId));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/refunds/{txId}/reject")
    public ResponseEntity<?> rejectRefund(@PathVariable Long txId) {
        try {
            return ResponseEntity.ok(adminService.rejectRefund(txId));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }
}
