package payment_system_backend.service;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import jakarta.transaction.Transactional;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import payment_system_backend.model.Transaction;
import payment_system_backend.model.User;
import payment_system_backend.repository.TransactionRepository;
import payment_system_backend.repository.UserRepository;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Map;

@Service
public class PaymentGatewayService {

    @Value("${razorpay.key-id:}")
    private String razorpayKeyId;

    @Value("${razorpay.key-secret:}")
    private String razorpayKeySecret;

    @Value("${razorpay.webhook-secret:}")
    private String razorpayWebhookSecret;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationService notificationService;

    @Transactional
    public Map<String, Object> createWalletTopUpOrder(Long userId, double amount) {
        if (amount <= 0) {
            throw new RuntimeException("Amount must be greater than 0");
        }
        if (amount > 100000) {
            throw new RuntimeException("Maximum top-up amount is ₹100000");
        }
        ensureRazorpayConfigured();

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        try {
            long amountPaise = Math.round(amount * 100);
            RazorpayClient client = new RazorpayClient(razorpayKeyId, razorpayKeySecret);

            JSONObject orderRequest = new JSONObject();
            orderRequest.put("amount", amountPaise);
            orderRequest.put("currency", "INR");
            orderRequest.put("receipt", "wallet_" + userId + "_" + System.currentTimeMillis());
            orderRequest.put("payment_capture", 1);

            Order order = client.orders.create(orderRequest);
            String orderId = order.get("id");

            Transaction tx = new Transaction();
            tx.setReceiverId(userId);
            tx.setAmount(amount);
            tx.setStatus("PENDING");
            tx.setGatewayStatus("CREATED");
            tx.setGatewayProvider("RAZORPAY");
            tx.setGatewayOrderId(orderId);
            tx.setCurrency("INR");
            tx.setCategory("WALLET_TOPUP");
            tx.setDescription("Wallet top-up via Razorpay");
            tx.setTime(LocalDateTime.now());
            transactionRepository.save(tx);

            return Map.of(
                    "keyId", razorpayKeyId,
                    "orderId", orderId,
                    "transactionId", tx.getId(),
                    "amount", amountPaise,
                    "currency", "INR",
                    "name", user.getName() != null ? user.getName() : "PayFlow User",
                    "email", user.getEmail() != null ? user.getEmail() : ""
            );
        } catch (Exception e) {
            throw new RuntimeException("Unable to create payment order: " + e.getMessage());
        }
    }

    @Transactional
    public User verifyWalletTopUp(Long userId, String orderId, String paymentId, String signature) {
        if (isBlank(orderId) || isBlank(paymentId) || isBlank(signature)) {
            throw new RuntimeException("Payment verification details are missing");
        }
        ensureRazorpayConfigured();

        Transaction tx = transactionRepository.findByGatewayOrderId(orderId)
                .orElseThrow(() -> new RuntimeException("Payment order not found"));

        if (!userId.equals(tx.getReceiverId())) {
            throw new RuntimeException("Payment order does not belong to this user");
        }
        if ("SUCCESS".equals(tx.getStatus())) {
            return userRepository.findById(userId).orElseThrow();
        }
        if (!verifyHmac(orderId + "|" + paymentId, signature, razorpayKeySecret)) {
            markFailed(tx, paymentId, signature, "Invalid Razorpay signature");
            throw new RuntimeException("Payment verification failed");
        }

        return creditVerifiedTopUp(tx, paymentId, signature, "CAPTURED");
    }

    @Transactional
    public void handleRazorpayWebhook(String payload, String signature) {
        if (isBlank(razorpayWebhookSecret)) {
            throw new RuntimeException("Razorpay webhook secret is not configured");
        }
        if (!verifyHmac(payload, signature, razorpayWebhookSecret)) {
            throw new RuntimeException("Invalid webhook signature");
        }

        JSONObject body = new JSONObject(payload);
        String event = body.optString("event");
        JSONObject payment = body.optJSONObject("payload")
                .optJSONObject("payment")
                .optJSONObject("entity");

        if (payment == null) return;

        String orderId = payment.optString("order_id");
        String paymentId = payment.optString("id");
        String status = payment.optString("status");

        transactionRepository.findByGatewayOrderId(orderId).ifPresent(tx -> {
            if ("payment.captured".equals(event) || "captured".equals(status)) {
                creditVerifiedTopUp(tx, paymentId, signature, "CAPTURED");
            } else if ("payment.failed".equals(event) || "failed".equals(status)) {
                markFailed(tx, paymentId, signature,
                        payment.optJSONObject("error") != null
                                ? payment.optJSONObject("error").optString("description", "Payment failed")
                                : "Payment failed");
            }
        });
    }

    private User creditVerifiedTopUp(Transaction tx, String paymentId, String signature, String gatewayStatus) {
        User user = userRepository.findById(tx.getReceiverId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if ("SUCCESS".equals(tx.getStatus())) {
            return user;
        }

        tx.setGatewayPaymentId(paymentId);
        tx.setGatewaySignature(signature);
        tx.setGatewayStatus(gatewayStatus);
        tx.setStatus("SUCCESS");
        tx.setFailureReason(null);
        transactionRepository.save(tx);

        user.setBalance(user.getBalance() + tx.getAmount());
        User saved = userRepository.save(user);

        notificationService.pushBalanceUpdate(user.getId(), saved.getBalance());
        notificationService.createNotification(user.getId(),
                "Wallet Top-up Successful",
                "₹" + String.format("%.2f", tx.getAmount()) + " has been added to your wallet.",
                "SUCCESS");

        return saved;
    }

    private void markFailed(Transaction tx, String paymentId, String signature, String reason) {
        if ("SUCCESS".equals(tx.getStatus())) {
            return;
        }
        tx.setGatewayPaymentId(paymentId);
        tx.setGatewaySignature(signature);
        tx.setGatewayStatus("FAILED");
        tx.setStatus("FAILED");
        tx.setFailureReason(reason);
        transactionRepository.save(tx);
    }

    private void ensureRazorpayConfigured() {
        if (isBlank(razorpayKeyId) || isBlank(razorpayKeySecret)) {
            throw new RuntimeException("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
        }
    }

    private boolean verifyHmac(String payload, String expectedSignature, String secret) {
        if (isBlank(expectedSignature) || isBlank(secret)) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String actual = HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
            return MessageDigest.isEqual(
                    actual.getBytes(StandardCharsets.UTF_8),
                    expectedSignature.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
