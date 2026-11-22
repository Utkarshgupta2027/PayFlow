package payment_system_backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import payment_system_backend.model.OfflineWallet;
import payment_system_backend.model.User;
import payment_system_backend.repository.OfflineWalletRepository;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.scheduler.OfflineWalletExpiryScheduler;
import payment_system_backend.service.NotificationService;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class OfflineWalletExpirySchedulerTest {

    @InjectMocks
    private OfflineWalletExpiryScheduler scheduler;

    @Mock private OfflineWalletRepository offlineWalletRepo;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;

    private User user;
    private OfflineWallet wallet;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);

        user = new User();
        user.setId(5L);
        user.setBalance(1000.0);

        wallet = new OfflineWallet();
        wallet.setId(20L);
        wallet.setUserId(5L);
        wallet.setEscrowAmount(800.0);
        wallet.setSpentAmount(300.0); // 500 unused
        wallet.setStatus("ACTIVE");
        wallet.setExpiry(LocalDateTime.now().minusMinutes(10));

        when(userRepository.findById(5L)).thenReturn(Optional.of(user));
        when(offlineWalletRepo.findByUserIdForUpdate(5L)).thenReturn(Optional.of(wallet));
        when(offlineWalletRepo.save(any(OfflineWallet.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void testProcessExpiredWallets_RefundsUnspentEscrow() {
        when(offlineWalletRepo.findByStatusAndExpiryBefore(eq("ACTIVE"), any(LocalDateTime.class)))
                .thenReturn(List.of(wallet));

        scheduler.processExpiredWallets();

        assertEquals("EXPIRED", wallet.getStatus());
        assertEquals(300.0, wallet.getEscrowAmount()); // Reduced to spent
        assertEquals(1500.0, user.getBalance(), 0.01); // 1000 + 500 refunded

        verify(notificationService).pushBalanceUpdate(eq(5L), eq(1500.0));
        verify(notificationService).createNotification(eq(5L), contains("Expired"), contains("returned"), eq("INFO"));
        verify(offlineWalletRepo).save(wallet);
    }
}
