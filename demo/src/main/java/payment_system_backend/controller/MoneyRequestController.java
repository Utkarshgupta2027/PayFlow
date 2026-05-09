package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.model.MoneyRequest;
import payment_system_backend.model.User;
import payment_system_backend.repository.MoneyRequestRepository;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.service.MoneyRequestService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/request-money")
public class MoneyRequestController {

    @Autowired
    private MoneyRequestService moneyRequestService;

    @Autowired
    private MoneyRequestRepository moneyRequestRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/create")
    public ResponseEntity<?> createRequest(
            @RequestParam Long targetUserId,
            @RequestParam double amount,
            @RequestParam(required = false) String description,
            Authentication authentication) {
        try {
            User requester = currentUser(authentication);
            MoneyRequest req = moneyRequestService.createRequest(requester.getId(), targetUserId, amount, description);
            return ResponseEntity.ok(req);
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{id}/accept")
    public ResponseEntity<?> acceptRequest(
            @PathVariable Long id,
            @RequestParam(required = false) String transactionPin,
            Authentication authentication) {
        try {
            User targetUser = currentUser(authentication);
            
            // Transaction PIN verification
            if (targetUser.getTransactionPin() != null) {
                if (transactionPin == null || transactionPin.isBlank()) {
                    return ResponseEntity.status(403).body(Map.of("error", "Transaction PIN is required."));
                }
                if (!passwordEncoder.matches(transactionPin, targetUser.getTransactionPin())) {
                    return ResponseEntity.status(403).body(Map.of("error", "Incorrect Transaction PIN."));
                }
            }

            MoneyRequest req = moneyRequestService.acceptRequest(id, targetUser.getId());
            return ResponseEntity.ok(Map.of("message", "Request accepted successfully", "request", req));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{id}/decline")
    public ResponseEntity<?> declineRequest(
            @PathVariable Long id,
            Authentication authentication) {
        try {
            User targetUser = currentUser(authentication);
            MoneyRequest req = moneyRequestService.declineRequest(id, targetUser.getId());
            return ResponseEntity.ok(Map.of("message", "Request declined", "request", req));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancelRequest(
            @PathVariable Long id,
            Authentication authentication) {
        try {
            User requester = currentUser(authentication);
            MoneyRequest req = moneyRequestService.cancelRequest(id, requester.getId());
            return ResponseEntity.ok(Map.of("message", "Request cancelled", "request", req));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/incoming")
    public ResponseEntity<List<Map<String, Object>>> getIncomingRequests(Authentication authentication) {
        User user = currentUser(authentication);
        List<MoneyRequest> requests = moneyRequestRepository.findByTargetUserIdOrderByCreatedAtDesc(user.getId());
        return ResponseEntity.ok(enrichRequests(requests, true));
    }

    @GetMapping("/outgoing")
    public ResponseEntity<List<Map<String, Object>>> getOutgoingRequests(Authentication authentication) {
        User user = currentUser(authentication);
        List<MoneyRequest> requests = moneyRequestRepository.findByRequesterIdOrderByCreatedAtDesc(user.getId());
        return ResponseEntity.ok(enrichRequests(requests, false));
    }

    private List<Map<String, Object>> enrichRequests(List<MoneyRequest> requests, boolean isIncoming) {
        return requests.stream().map(req -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", req.getId());
            map.put("amount", req.getAmount());
            map.put("description", req.getDescription());
            map.put("status", req.getStatus());
            map.put("createdAt", req.getCreatedAt());
            
            // If incoming, we want to know who the requester is
            // If outgoing, we want to know who the target is
            Long otherUserId = isIncoming ? req.getRequesterId() : req.getTargetUserId();
            User otherUser = userRepository.findById(otherUserId).orElse(null);
            
            if (otherUser != null) {
                map.put("otherUserId", otherUser.getId());
                map.put("otherUserName", otherUser.getName());
                map.put("otherUserEmail", otherUser.getEmail());
            }
            return map;
        }).collect(Collectors.toList());
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
