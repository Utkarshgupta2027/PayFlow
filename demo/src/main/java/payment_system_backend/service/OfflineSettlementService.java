package payment_system_backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import payment_system_backend.config.OfflinePaymentConfig;
import payment_system_backend.dto.OfflineSyncResponse;
import payment_system_backend.dto.OfflineTokenDto;
import payment_system_backend.model.OfflineTransaction;
import payment_system_backend.model.OfflineWallet;
import payment_system_backend.model.Transaction;
import payment_system_backend.model.User;
import payment_system_backend.repository.OfflineTransactionRepository;
import payment_system_backend.repository.OfflineWalletRepository;
import payment_system_backend.repository.TransactionRepository;
import payment_system_backend.repository.UserRepository;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;

@Service
public class OfflineSettlementService {

    private static final Logger log = LoggerFactory.getLogger(OfflineSettlementService.class);

    @Autowired
    private OfflineWalletRepository offlineWalletRepo;

    @Autowired
    private OfflineTransactionRepository offlineTxRepo;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TransactionRepository transactionRepo;

    @Autowired
    private OfflineCryptoService cryptoService;

    @Autowired
    private OfflinePaymentConfig config;

    @Autowired
    private NotificationService notificationService;

    @Autowired(required = false)
    private RewardService rewardService;

    /**
     * Settles a single offline token in an isolated transaction.
     * Uses pessimistic write locking on the OfflineWallet row to guarantee
     * no race conditions or double settlements under concurrent execution.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public OfflineSyncResponse.TokenResult settleSingleToken(OfflineTokenDto token) {
        if (token == null) {
            return new OfflineSyncResponse.TokenResult("UNKNOWN", "REJECTED", "Token payload is null");
        }

        String tokenId = token.getTokenId();
        if (tokenId == null || tokenId.isBlank()) {
            return recordAndReject(token, "Missing tokenId");
        }

        // 1. Idempotency check: skip if tokenId already exists
        Optional<OfflineTransaction> existing = offlineTxRepo.findByTokenId(tokenId);
        if (existing.isPresent()) {
            OfflineTransaction tx = existing.get();
            if ("SETTLED".equalsIgnoreCase(tx.getStatus())) {
                return new OfflineSyncResponse.TokenResult(tokenId, "DUPLICATE", "Token has already been settled");
            } else {
                return new OfflineSyncResponse.TokenResult(tokenId, "REJECTED",
                        tx.getRejectReason() != null ? tx.getRejectReason() : "Previously rejected");
            }
        }

        // 2. Validate basic token fields and amount
        double amount = token.getAmount();
        if (amount <= 0) {
            return recordAndReject(token, "Invalid token amount: must be greater than 0");
        }
        if (amount > config.getMaxPerTransaction()) {
            return recordAndReject(token, "Amount ₹" + amount + " exceeds max per transaction limit of ₹" + config.getMaxPerTransaction());
        }

        if (token.getCertId() == null || token.getCertId().isBlank()) {
            return recordAndReject(token, "Token is missing certId");
        }
        if (token.getSenderId() == null || token.getReceiverId() == null) {
            return recordAndReject(token, "Sender ID and Receiver ID are required");
        }
        if (token.getSenderId().equals(token.getReceiverId())) {
            return recordAndReject(token, "Sender and receiver cannot be the same user");
        }

        // 3. Acquire pessimistic write lock on the wallet row
        Optional<OfflineWallet> walletOpt = offlineWalletRepo.findByCertIdForUpdate(token.getCertId());
        if (walletOpt.isEmpty()) {
            return recordAndReject(token, "Offline wallet not found for certId: " + token.getCertId());
        }
        OfflineWallet wallet = walletOpt.get();

        // 4. Verify sender matches wallet owner
        if (!wallet.getUserId().equals(token.getSenderId())) {
            return recordAndReject(token, "Sender ID " + token.getSenderId() + " does not match wallet owner " + wallet.getUserId());
        }

        // 5. Verify receiver exists
        Optional<User> receiverOpt = userRepository.findById(token.getReceiverId());
        if (receiverOpt.isEmpty()) {
            return recordAndReject(token, "Receiver user not found: " + token.getReceiverId());
        }
        User receiver = receiverOpt.get();

        // 6. Verify wallet status and expiry
        if (!"ACTIVE".equals(wallet.getStatus())) {
            return recordAndReject(token, "Offline wallet is not active (status: " + wallet.getStatus() + ")");
        }
        if (wallet.getExpiry().isBefore(LocalDateTime.now())) {
            return recordAndReject(token, "Wallet certificate has expired on " + wallet.getExpiry());
        }

        // 7. Verify token cryptographic signature with sender's registered public key
        String canonicalToken = cryptoService.canonicalTokenString(
                tokenId,
                token.getCertId(),
                token.getSenderId(),
                token.getReceiverId(),
                amount,
                token.getCounter(),
                token.getTimestamp()
        );

        boolean signatureValid = cryptoService.verifyTokenSignature(
                wallet.getPublicKey(),
                canonicalToken,
                token.getSignature()
        );
        if (!signatureValid) {
            return recordAndReject(token, "Invalid cryptographic token signature");
        }

        // 8. Require strictly increasing counter (counter > last settled counter for this cert)
        long lastCounter = offlineTxRepo.findMaxCounterByCertId(wallet.getCertId());
        if (token.getCounter() <= lastCounter) {
            return recordAndReject(token, "Counter replay detected: token counter (" + token.getCounter() +
                    ") must be strictly greater than last settled counter (" + lastCounter + ")");
        }

        // 9. Require spentAmount + amount <= escrowAmount
        if (wallet.getSpentAmount() + amount > wallet.getEscrowAmount()) {
            return recordAndReject(token, "Escrow balance exceeded: remaining ₹" +
                    String.format("%.2f", wallet.getRemainingAmount()) + ", requested ₹" + String.format("%.2f", amount));
        }

        // 10. Execute settlement
        // Update wallet spent amount
        wallet.setSpentAmount(wallet.getSpentAmount() + amount);
        offlineWalletRepo.save(wallet);

        // Credit receiver main balance
        receiver.setBalance(receiver.getBalance() + amount);
        userRepository.save(receiver);

        // Record OfflineTransaction as SETTLED
        OfflineTransaction offTx = new OfflineTransaction();
        offTx.setTokenId(tokenId);
        offTx.setCertId(token.getCertId());
        offTx.setSenderId(token.getSenderId());
        offTx.setReceiverId(token.getReceiverId());
        offTx.setAmount(amount);
        offTx.setCounter(token.getCounter());
        offTx.setStatus("SETTLED");
        offTx.setSettledAt(LocalDateTime.now());
        if (token.getTimestamp() != null && token.getTimestamp() > 0) {
            offTx.setTokenTimestamp(LocalDateTime.ofInstant(Instant.ofEpochMilli(token.getTimestamp()), ZoneId.systemDefault()));
        } else {
            offTx.setTokenTimestamp(LocalDateTime.now());
        }
        offlineTxRepo.save(offTx);

        // Create normal Transaction record with category "OFFLINE"
        Transaction mainTx = new Transaction();
        mainTx.setSenderId(token.getSenderId());
        mainTx.setReceiverId(token.getReceiverId());
        mainTx.setAmount(amount);
        mainTx.setStatus("SUCCESS");
        mainTx.setTime(LocalDateTime.now());
        mainTx.setCategory("OFFLINE");
        mainTx.setDescription("Offline Payment Settlement (Token " + tokenId.substring(0, Math.min(8, tokenId.length())) + ")");
        transactionRepo.save(mainTx);

        // Award reward points if service available
        if (rewardService != null) {
            try {
                rewardService.awardTransactionPoints(token.getSenderId(), amount);
            } catch (Exception ignored) {}
        }

        // Push real-time balance update to receiver
        notificationService.pushBalanceUpdate(receiver.getId(), receiver.getBalance());

        // In-app notifications to both sender and receiver
        User sender = userRepository.findById(token.getSenderId()).orElse(null);
        String senderName = sender != null ? sender.getName() : ("User #" + token.getSenderId());
        String receiverName = receiver.getName();

        notificationService.createNotification(
                token.getSenderId(),
                "✅ Offline Payment Settled",
                "Your offline payment of ₹" + String.format("%.2f", amount) + " to " + receiverName + " has been settled.",
                "SUCCESS"
        );

        notificationService.createNotification(
                token.getReceiverId(),
                "💰 Money Received (Offline)",
                "Received ₹" + String.format("%.2f", amount) + " from " + senderName + " via offline payment.",
                "SUCCESS"
        );

        log.info("[OfflineSettlement] Token {} successfully settled for ₹{}", tokenId, amount);
        return new OfflineSyncResponse.TokenResult(tokenId, "SETTLED", "Payment settled successfully");
    }

    private OfflineSyncResponse.TokenResult recordAndReject(OfflineTokenDto token, String reason) {
        log.warn("[OfflineSettlement] Token {} rejected: {}", token.getTokenId(), reason);
        try {
            OfflineTransaction offTx = new OfflineTransaction();
            offTx.setTokenId(token.getTokenId() != null ? token.getTokenId() : UUID.randomUUID().toString());
            offTx.setCertId(token.getCertId() != null ? token.getCertId() : "UNKNOWN");
            offTx.setSenderId(token.getSenderId() != null ? token.getSenderId() : 0L);
            offTx.setReceiverId(token.getReceiverId() != null ? token.getReceiverId() : 0L);
            offTx.setAmount(token.getAmount());
            offTx.setCounter(token.getCounter());
            offTx.setStatus("REJECTED");
            offTx.setRejectReason(reason);
            offTx.setSettledAt(LocalDateTime.now());
            offlineTxRepo.save(offTx);
        } catch (Exception ex) {
            log.debug("Could not record rejected transaction row: {}", ex.getMessage());
        }

        return new OfflineSyncResponse.TokenResult(token.getTokenId(), "REJECTED", reason);
    }
}

