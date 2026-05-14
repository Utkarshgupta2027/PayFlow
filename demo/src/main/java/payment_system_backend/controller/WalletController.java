package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.dto.AddMoneyRequest;
import payment_system_backend.dto.CreatePaymentOrderRequest;
import payment_system_backend.dto.VerifyPaymentRequest;
import payment_system_backend.dto.WithdrawMoneyRequest;
import payment_system_backend.model.Transaction;
import payment_system_backend.model.User;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.service.PaymentGatewayService;
import payment_system_backend.service.WalletService;

import java.util.Map;

@RestController
@RequestMapping("/wallet")
public class WalletController {
    @GetMapping("/run")
    public String test(){
        return "Backend is running";
    }

    @Autowired
    private WalletService walletService;

    @Autowired
    private PaymentGatewayService paymentGatewayService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * Legacy direct credit endpoint kept blocked for real-money safety.
     * Use /wallet/payment/order and /wallet/payment/verify instead.
     */
    @PostMapping("/addMoney")
    public ResponseEntity<?> addMoney(@RequestBody AddMoneyRequest request,
                                      Authentication authentication){
        try {
            User user = currentUser(authentication);
            verifyTransactionPin(user, request.getTransactionPin());
            User updatedUser = walletService.addMoney(user.getId(), request.getAmount());
            return ResponseEntity.ok(updatedUser);
        } catch (RuntimeException ex) {
            return ResponseEntity.status(403).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/payment/order")
    public ResponseEntity<?> createPaymentOrder(@RequestBody CreatePaymentOrderRequest request,
                                                Authentication authentication) {
        try {
            User user = currentUser(authentication);
            return ResponseEntity.ok(paymentGatewayService.createWalletTopUpOrder(user.getId(), request.getAmount()));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/payment/verify")
    public ResponseEntity<?> verifyPayment(@RequestBody VerifyPaymentRequest request,
                                           Authentication authentication) {
        try {
            User user = currentUser(authentication);
            User updated = paymentGatewayService.verifyWalletTopUp(
                    user.getId(),
                    request.getRazorpayOrderId(),
                    request.getRazorpayPaymentId(),
                    request.getRazorpaySignature());
            return ResponseEntity.ok(updated);
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/withdraw")
    public ResponseEntity<?> withdrawToBank(@RequestBody WithdrawMoneyRequest request,
                                            Authentication authentication) {
        try {
            User user = currentUser(authentication);
            Transaction tx = walletService.withdrawToBank(
                    user.getId(),
                    request.getAmount(),
                    request.getBankAccountId(),
                    request.getDescription());
            User updated = userRepository.findById(user.getId()).orElse(user);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Withdrawal initiated successfully",
                    "transaction", tx,
                    "user", updated));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/payment/webhook")
    public ResponseEntity<?> razorpayWebhook(@RequestBody String payload,
                                             @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {
        try {
            paymentGatewayService.handleRazorpayWebhook(payload, signature);
            return ResponseEntity.ok(Map.of("status", "ok"));
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

    private void verifyTransactionPin(User user, String transactionPin) {
        if (user.getTransactionPin() == null) {
            throw new RuntimeException("Set a Transaction PIN before adding money.");
        }
        if (transactionPin == null || transactionPin.isBlank()) {
            throw new RuntimeException("Transaction PIN is required.");
        }
        if (!passwordEncoder.matches(transactionPin, user.getTransactionPin())) {
            throw new RuntimeException("Incorrect Transaction PIN.");
        }
    }
}
