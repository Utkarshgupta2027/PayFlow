package payment_system_backend.scheduler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import payment_system_backend.model.OfflineWallet;
import payment_system_backend.model.User;
import payment_system_backend.repository.OfflineWalletRepository;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.service.NotificationService;

import java.time.LocalDateTime;
import java.util.List;

@Component
public class OfflineWalletExpiryScheduler {

    private static final Logger log = LoggerFactory.getLogger(OfflineWalletExpiryScheduler.class);

    @Autowired
    private OfflineWalletRepository offlineWalletRepo;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationService notificationService;

    /**
     * Periodically check for expired active offline wallets, mark them as EXPIRED,
     * and release any unspent escrow funds back to the user's main wallet.
     */
    @Scheduled(fixedDelayString = "${OFFLINE_EXPIRY_CHECK_MS:60000}", initialDelay = 10000)
    public void processExpiredWallets() {
        try {
            LocalDateTime now = LocalDateTime.now();
            List<OfflineWallet> expiredWallets = offlineWalletRepo.findByStatusAndExpiryBefore("ACTIVE", now);

            if (!expiredWallets.isEmpty()) {
                log.info("[OfflineExpiry] Found {} expired offline wallet(s) to process", expiredWallets.size());
                for (OfflineWallet wallet : expiredWallets) {
                    try {
                        expireSingleWallet(wallet.getUserId());
                    } catch (Exception e) {
                        log.error("[OfflineExpiry] Failed to expire wallet for userId {}: {}", wallet.getUserId(), e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.error("[OfflineExpiry] Error during expiry check: {}", e.getMessage(), e);
        }
    }

    @Transactional
    public void expireSingleWallet(Long userId) {
        OfflineWallet wallet = offlineWalletRepo.findByUserIdForUpdate(userId).orElse(null);
        if (wallet == null || !"ACTIVE".equals(wallet.getStatus())) {
            return;
        }

        if (wallet.getExpiry().isAfter(LocalDateTime.now())) {
            return; // Not yet expired
        }

        double unused = wallet.getRemainingAmount();
        User user = userRepository.findById(userId).orElse(null);

        if (user != null && unused > 0) {
            user.setBalance(user.getBalance() + unused);
            userRepository.save(user);
            notificationService.pushBalanceUpdate(userId, user.getBalance());
            notificationService.createNotification(
                    userId,
                    "⏰ Offline Wallet Expired",
                    "Your offline wallet certificate has expired. Unused escrow of ₹" + String.format("%.2f", unused) + " has been returned to your balance.",
                    "INFO"
            );
        }

        wallet.setEscrowAmount(wallet.getSpentAmount());
        wallet.setStatus("EXPIRED");
        offlineWalletRepo.save(wallet);

        log.info("[OfflineExpiry] Expired wallet for user {} and refunded ₹{}", userId, unused);
    }
}

