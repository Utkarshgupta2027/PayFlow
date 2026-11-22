package payment_system_backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.dto.*;
import payment_system_backend.model.User;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.security.AdminAccess;
import payment_system_backend.service.OfflineCryptoService;
import payment_system_backend.service.OfflineWalletService;

import java.util.Map;

@RestController
@RequestMapping("/offline")
@Tag(name = "Offline Payments", description = "Offline escrow wallet management, certificate issuance, and settlement APIs")
public class OfflineController {

    @Autowired
    private OfflineWalletService offlineWalletService;

    @Autowired
    private OfflineCryptoService offlineCryptoService;

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/enable")
    @Operation(summary = "Enable offline mode and allocate escrow funds", description = "Deducts funds from main balance into offline escrow and issues a server-signed certificate.")
    public ResponseEntity<?> enable(@RequestBody EnableOfflineRequest request, Authentication authentication) {
        try {
            User user = currentUser(authentication);
            OfflineWalletStatusResponse response = offlineWalletService.enable(user.getId(), request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException ex) {
            int status = isPinError(ex) ? 403 : 400;
            return ResponseEntity.status(status).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/topup")
    @Operation(summary = "Top up offline escrow", description = "Adds additional funds from the main balance to the existing active offline escrow.")
    public ResponseEntity<?> topUp(@RequestBody TopUpOfflineRequest request, Authentication authentication) {
        try {
            User user = currentUser(authentication);
            OfflineWalletStatusResponse response = offlineWalletService.topUp(user.getId(), request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException ex) {
            int status = isPinError(ex) ? 403 : 400;
            return ResponseEntity.status(status).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/release")
    @Operation(summary = "Release unspent escrow", description = "Releases remaining unspent offline escrow funds back to user's main wallet balance.")
    public ResponseEntity<?> release(@RequestBody ReleaseOfflineRequest request, Authentication authentication) {
        try {
            User user = currentUser(authentication);
            Map<String, Object> result = offlineWalletService.release(user.getId(), request);
            return ResponseEntity.ok(result);
        } catch (RuntimeException ex) {
            int status = isPinError(ex) ? 403 : 400;
            return ResponseEntity.status(status).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/revoke")
    @Operation(summary = "Revoke offline wallet", description = "Deactivates offline wallet (e.g. lost device) and refunds remaining escrow back to user.")
    public ResponseEntity<?> revoke(@RequestBody(required = false) RevokeOfflineRequest request, Authentication authentication) {
        try {
            User user = currentUser(authentication);
            boolean isAdmin = AdminAccess.isAdminEmail(user.getEmail()) || "ADMIN".equalsIgnoreCase(user.getRole());
            Long targetUserId = (request != null && request.getUserId() != null) ? request.getUserId() : user.getId();
            Map<String, Object> result = offlineWalletService.revoke(targetUserId, user.getId(), isAdmin);
            return ResponseEntity.ok(result);
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/status")
    @Operation(summary = "Get offline wallet status", description = "Returns active escrow amount, remaining balance, server certificate, and limits.")
    public ResponseEntity<?> status(Authentication authentication) {
        try {
            User user = currentUser(authentication);
            return ResponseEntity.ok(offlineWalletService.status(user.getId()));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/public-key")
    @Operation(summary = "Get server offline signing public key", description = "Returns the base64-encoded X.509 SPKI public key used by the server to sign offline certificates.")
    public ResponseEntity<?> getPublicKey() {
        return ResponseEntity.ok(Map.of(
                "serverPublicKey", offlineCryptoService.getServerPublicKeyBase64(),
                "algorithm", "ECDSA_P256_SHA256"
        ));
    }

    private boolean isPinError(RuntimeException ex) {
        return ex.getMessage() != null && ex.getMessage().toLowerCase().contains("pin");
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

