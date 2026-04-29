package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.dto.AddMoneyRequest;
import payment_system_backend.dto.CreatePaymentOrderRequest;
import payment_system_backend.dto.VerifyPaymentRequest;
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

    /**
     * Legacy direct credit endpoint kept blocked for real-money safety.
     * Use /wallet/payment/order and /wallet/payment/verify instead.
     */
    @PostMapping("/addMoney")
    public ResponseEntity<?> addMoney(@RequestBody AddMoneyRequest request){
        return ResponseEntity.status(410).body(Map.of(
                "error", "Direct wallet credit is disabled. Use verified payment gateway flow."));
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
}
