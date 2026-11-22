package payment_system_backend.service;

import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import payment_system_backend.config.OfflinePaymentConfig;
import payment_system_backend.dto.*;
import payment_system_backend.model.OfflineWallet;
import payment_system_backend.model.User;
import payment_system_backend.repository.OfflineTransactionRepository;
import payment_system_backend.repository.OfflineWalletRepository;
import payment_system_backend.repository.UserRepository;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class OfflineWalletService {

    private static final Logger log = LoggerFactory.getLogger(OfflineWalletService.class);
    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    @Autowired
    private OfflineWalletRepository offlineWalletRepo;

    @Autowired
    private OfflineTransactionRepository offlineTxRepo;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OfflinePaymentConfig config;

    @Autowired
    private OfflineCryptoService cryptoService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * Enable offline mode and allocate funds to escrow.
     */
    @Transactional
    public OfflineWalletStatusResponse enable(Long userId, EnableOfflineRequest request) {
        User user = getUserOrThrow(userId);
        validateFrozen(user);
        verifyPin(user, request.getTransactionPin());

        if (request.getPublicKey() == null || request.getPublicKey().isBlank()) {
            throw new RuntimeException("Public key is required to enable offline payments.");
        }

        double amount = request.getAmount();
        if (amount <= 0) {
            throw new RuntimeException("Escrow allocation amount must be greater than 0.");
        }
        if (amount > config.getMaxEscrow()) {
            throw new RuntimeException("Amount exceeds maximum allowed escrow limit of ₹" + config.getMaxEscrow());
        }
        if (user.getBalance() < amount) {
            throw new RuntimeException("Insufficient balance to allocate offline escrow.");
        }

        // Check if an active unexpired wallet already exists
        OfflineWallet wallet = offlineWalletRepo.findByUserIdForUpdate(userId).orElse(null);
        if (wallet != null && "ACTIVE".equals(wallet.getStatus())) {
            if (wallet.getExpiry().isAfter(LocalDateTime.now())) {
                throw new RuntimeException("An active offline wallet already exists. Please top up or release unused escrow.");
            } else {
                // Wallet expired — release remaining escrow before resetting
                double remaining = wallet.getRemainingAmount();
                if (remaining > 0) {
                    user.setBalance(user.getBalance() + remaining);
                }
            }
        }

        // Deduct from main balance
        user.setBalance(user.getBalance() - amount);
        userRepository.save(user);

        if (wallet == null) {
            wallet = new OfflineWallet();
            wallet.setUserId(userId);
        }

        wallet.setPublicKey(OfflineCryptoService.cleanKey(request.getPublicKey()));
        wallet.setEscrowAmount(amount);
        wallet.setSpentAmount(0.0);
        wallet.setCertId(UUID.randomUUID().toString());
        wallet.setExpiry(LocalDateTime.now().plusDays(config.getCertificateValidityDays()).truncatedTo(ChronoUnit.SECONDS));
        wallet.setStatus("ACTIVE");
        wallet.setCreatedAt(LocalDateTime.now());
        offlineWalletRepo.save(wallet);

        // Push WebSocket balance update
        notificationService.pushBalanceUpdate(userId, user.getBalance());

        // In-app notification
        notificationService.createNotification(
                userId,
                "🔒 Offline Payments Enabled",
                "Allocated ₹" + String.format("%.2f", amount) + " to offline escrow. Valid for " + config.getCertificateValidityDays() + " days.",
                "SUCCESS"
        );

        return buildStatusResponse(wallet);
    }

    /**
     * Top-up offline escrow balance from user's main wallet.
     */
    @Transactional
    public OfflineWalletStatusResponse topUp(Long userId, TopUpOfflineRequest request) {
        User user = getUserOrThrow(userId);
        validateFrozen(user);
        verifyPin(user, request.getTransactionPin());

        double amount = request.getAmount();
        if (amount <= 0) {
            throw new RuntimeException("Top-up amount must be greater than 0.");
        }

        OfflineWallet wallet = offlineWalletRepo.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new RuntimeException("Offline wallet not found. Please enable offline payments first."));

        if (!"ACTIVE".equals(wallet.getStatus())) {
            throw new RuntimeException("Offline wallet is not active (current status: " + wallet.getStatus() + ").");
        }
        if (wallet.getExpiry().isBefore(LocalDateTime.now())) {
            wallet.setStatus("EXPIRED");
            offlineWalletRepo.save(wallet);
            throw new RuntimeException("Offline wallet certificate has expired. Please release and re-enable.");
        }

        double newEscrow = wallet.getEscrowAmount() + amount;
        double newRemaining = wallet.getRemainingAmount() + amount;
        if (newRemaining > config.getMaxEscrow()) {
            throw new RuntimeException("Top-up would exceed maximum offline escrow limit of ₹" + config.getMaxEscrow());
        }
        if (user.getBalance() < amount) {
            throw new RuntimeException("Insufficient balance in main wallet for top-up.");
        }

        user.setBalance(user.getBalance() - amount);
        userRepository.save(user);

        wallet.setEscrowAmount(newEscrow);
        offlineWalletRepo.save(wallet);

        notificationService.pushBalanceUpdate(userId, user.getBalance());
        notificationService.createNotification(
                userId,
                "⬆️ Offline Escrow Topped Up",
                "Added ₹" + String.format("%.2f", amount) + " to offline escrow. Total escrow: ₹" + String.format("%.2f", newEscrow),
                "SUCCESS"
        );

        return buildStatusResponse(wallet);
    }

    /**
     * Release remaining unspent escrow funds back to main balance.
     */
    @Transactional
    public Map<String, Object> release(Long userId, ReleaseOfflineRequest request) {
        User user = getUserOrThrow(userId);
        validateFrozen(user);
        verifyPin(user, request.getTransactionPin());

        OfflineWallet wallet = offlineWalletRepo.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new RuntimeException("Offline wallet not found."));

        double remaining = wallet.getRemainingAmount();
        if (remaining <= 0) {
            throw new RuntimeException("No remaining escrow balance to release.");
        }

        user.setBalance(user.getBalance() + remaining);
        userRepository.save(user);

        wallet.setEscrowAmount(wallet.getSpentAmount()); // All remaining returned
        wallet.setStatus("REVOKED");
        offlineWalletRepo.save(wallet);

        notificationService.pushBalanceUpdate(userId, user.getBalance());
        notificationService.createNotification(
                userId,
                "🔓 Offline Escrow Released",
                "Released ₹" + String.format("%.2f", remaining) + " unused escrow back to your main balance.",
                "SUCCESS"
        );

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Escrow funds released successfully");
        response.put("releasedAmount", remaining);
        response.put("newBalance", user.getBalance());
        return response;
    }

    /**
     * Revoke offline wallet (lost-device flow or admin action) and return remaining escrow.
     */
    @Transactional
    public Map<String, Object> revoke(Long targetUserId, Long actionUserId, boolean isAdmin) {
        if (!isAdmin && !targetUserId.equals(actionUserId)) {
            throw new RuntimeException("Unauthorized: Cannot revoke another user's offline wallet.");
        }

        User targetUser = getUserOrThrow(targetUserId);
        OfflineWallet wallet = offlineWalletRepo.findByUserIdForUpdate(targetUserId)
                .orElseThrow(() -> new RuntimeException("Offline wallet not found for user " + targetUserId));

        double remaining = wallet.getRemainingAmount();
        if (remaining > 0) {
            targetUser.setBalance(targetUser.getBalance() + remaining);
            userRepository.save(targetUser);
            notificationService.pushBalanceUpdate(targetUserId, targetUser.getBalance());
        }

        wallet.setEscrowAmount(wallet.getSpentAmount());
        wallet.setStatus("REVOKED");
        offlineWalletRepo.save(wallet);

        String note = isAdmin ? " by administrator." : " by user request.";
        notificationService.createNotification(
                targetUserId,
                "🚨 Offline Wallet Revoked",
                "Your offline wallet was revoked" + note + (remaining > 0 ? " ₹" + String.format("%.2f", remaining) + " returned to your main balance." : ""),
                "WARNING"
        );

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Offline wallet revoked successfully");
        response.put("refundedAmount", remaining);
        response.put("status", "REVOKED");
        return response;
    }

    /**
     * Get offline wallet status for user.
     */
    public OfflineWalletStatusResponse status(Long userId) {
        OfflineWallet wallet = offlineWalletRepo.findByUserId(userId).orElse(null);
        if (wallet == null) {
            OfflineWalletStatusResponse resp = new OfflineWalletStatusResponse();
            resp.setActive(false);
            resp.setConfig(buildConfigMap());
            return resp;
        }

        // Check if expired
        if ("ACTIVE".equals(wallet.getStatus()) && wallet.getExpiry().isBefore(LocalDateTime.now())) {
            wallet.setStatus("EXPIRED");
        }

        return buildStatusResponse(wallet);
    }

    /**
     * Construct certificate DTO signed by server ECDSA private key.
     */
    public OfflineCertificateDto createCertificateDto(OfflineWallet wallet) {
        String expiryStr = wallet.getExpiry().truncatedTo(ChronoUnit.SECONDS).format(ISO_FORMATTER);
        String signature = cryptoService.signCertificate(
                wallet.getCertId(),
                wallet.getUserId(),
                wallet.getPublicKey(),
                wallet.getEscrowAmount(),
                expiryStr
        );
        return new OfflineCertificateDto(
                wallet.getCertId(),
                wallet.getUserId(),
                wallet.getPublicKey(),
                wallet.getEscrowAmount(),
                expiryStr,
                signature
        );
    }

    public OfflineWalletStatusResponse buildStatusResponse(OfflineWallet wallet) {
        OfflineWalletStatusResponse resp = new OfflineWalletStatusResponse();
        boolean isActive = "ACTIVE".equals(wallet.getStatus()) && wallet.getExpiry().isAfter(LocalDateTime.now());
        resp.setActive(isActive);
        resp.setWallet(wallet);
        resp.setRemainingEscrow(wallet.getRemainingAmount());
        if (isActive) {
            resp.setCertificate(createCertificateDto(wallet));
        }
        resp.setConfig(buildConfigMap());
        return resp;
    }

    public Map<String, Object> buildConfigMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("maxPerTransaction", config.getMaxPerTransaction());
        map.put("maxEscrow", config.getMaxEscrow());
        map.put("certificateValidityDays", config.getCertificateValidityDays());
        map.put("serverPublicKey", cryptoService.getServerPublicKeyBase64());
        return map;
    }

    private User getUserOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + userId));
    }

    private void validateFrozen(User user) {
        if (user.isFrozen()) {
            throw new RuntimeException("Your account has been frozen. Please contact support.");
        }
    }

    private void verifyPin(User user, String transactionPin) {
        if (user.getTransactionPin() == null) {
            throw new RuntimeException("Set a Transaction PIN before using offline payments.");
        }
        if (transactionPin == null || transactionPin.isBlank()) {
            throw new RuntimeException("Transaction PIN is required.");
        }
        if (!passwordEncoder.matches(transactionPin, user.getTransactionPin())) {
            throw new RuntimeException("Incorrect Transaction PIN.");
        }
    }
}

