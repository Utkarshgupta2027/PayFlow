package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.dto.BillPaymentRequest;
import payment_system_backend.model.User;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.service.BillPaymentService;

import java.util.Map;

@RestController
@RequestMapping("/bill-payments")
public class BillPaymentController {

    @Autowired
    private BillPaymentService billPaymentService;

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/pay")
    public ResponseEntity<?> payBill(@RequestBody BillPaymentRequest request,
                                     Authentication authentication) {
        try {
            User user = currentUser(authentication);
            BillPaymentService.BillPaymentResult result = billPaymentService.payBill(
                    user.getId(),
                    request.getBillType(),
                    request.getProvider(),
                    request.getAccountNumber(),
                    request.getAmount(),
                    request.getDescription());
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Bill payment successful",
                    "transaction", result.getTransaction(),
                    "user", result.getUser(),
                    "pointsAwarded", result.getPointsAwarded(),
                    "cashback", result.getCashback()));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
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
}
