package payment_system_backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import payment_system_backend.config.OfflinePaymentConfig;
import payment_system_backend.dto.EnableOfflineRequest;
import payment_system_backend.dto.OfflineWalletStatusResponse;
import payment_system_backend.dto.ReleaseOfflineRequest;
import payment_system_backend.dto.TopUpOfflineRequest;
import payment_system_backend.model.OfflineWallet;
import payment_system_backend.model.User;
import payment_system_backend.repository.OfflineTransactionRepository;
import payment_system_backend.repository.OfflineWalletRepository;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.service.NotificationService;
import payment_system_backend.service.OfflineCryptoService;
import payment_system_backend.service.OfflineWalletService;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class OfflineWalletServiceTest {

    @InjectMocks
    private OfflineWalletService walletService;

    @Mock private OfflineWalletRepository offlineWalletRepo;
    @Mock private OfflineTransactionRepository offlineTxRepo;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;

    private PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private OfflinePaymentConfig config;
    private OfflineCryptoService cryptoService;

    private User sender;
    private final String RAW_PIN = "1234";

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);

        config = new OfflinePaymentConfig();
        ReflectionTestUtils.setField(config, "maxPerTransaction", 500.0);
        ReflectionTestUtils.setField(config, "maxEscrow", 2000.0);
        ReflectionTestUtils.setField(config, "certificateValidityDays", 7);

        cryptoService = new OfflineCryptoService();
        ReflectionTestUtils.setField(cryptoService, "config", config);
        cryptoService.init();

        ReflectionTestUtils.setField(walletService, "config", config);
        ReflectionTestUtils.setField(walletService, "cryptoService", cryptoService);
        ReflectionTestUtils.setField(walletService, "passwordEncoder", passwordEncoder);

        sender = new User();
        sender.setId(1L);
        sender.setName("Alice");
        sender.setEmail("alice@test.com");
        sender.setBalance(5000.0);
        sender.setFrozen(false);
        sender.setTransactionPin(passwordEncoder.encode(RAW_PIN));

        when(userRepository.findById(1L)).thenReturn(Optional.of(sender));
        when(offlineWalletRepo.save(any(OfflineWallet.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void testEnableOfflineWallet_Success() {
        when(offlineWalletRepo.findByUserIdForUpdate(1L)).thenReturn(Optional.empty());

        EnableOfflineRequest req = new EnableOfflineRequest();
        req.setPublicKey("MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAElBZKtJ+TE9FvLwfeD0mXErHj01niLuCjdATFr5P5oXlhYYBqqgxevjH9m1MVOuVL1EOR5jVkn3TOBtfNsmUFbg==");
        req.setAmount(1000.0);
        req.setTransactionPin(RAW_PIN);

        OfflineWalletStatusResponse resp = walletService.enable(1L, req);

        assertTrue(resp.isActive());
        assertEquals(4000.0, sender.getBalance(), 0.01);
        assertEquals(1000.0, resp.getWallet().getEscrowAmount());
        assertEquals(0.0, resp.getWallet().getSpentAmount());
        assertEquals(1000.0, resp.getRemainingEscrow());
        assertNotNull(resp.getCertificate());
        assertNotNull(resp.getCertificate().getSignature());

        verify(notificationService).pushBalanceUpdate(eq(1L), eq(4000.0));
    }

    @Test
    void testEnableOfflineWallet_WrongPin() {
        EnableOfflineRequest req = new EnableOfflineRequest();
        req.setPublicKey("MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAElBZKtJ+TE9FvLwfeD0mXErHj01niLuCjdATFr5P5oXlhYYBqqgxevjH9m1MVOuVL1EOR5jVkn3TOBtfNsmUFbg==");
        req.setAmount(1000.0);
        req.setTransactionPin("9999"); // Wrong PIN

        RuntimeException ex = assertThrows(RuntimeException.class, () -> walletService.enable(1L, req));
        assertTrue(ex.getMessage().contains("PIN"));
        assertEquals(5000.0, sender.getBalance()); // Unchanged
    }

    @Test
    void testEnableOfflineWallet_InsufficientBalance() {
        sender.setBalance(300.0);
        when(offlineWalletRepo.findByUserIdForUpdate(1L)).thenReturn(Optional.empty());

        EnableOfflineRequest req = new EnableOfflineRequest();
        req.setPublicKey("MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAElBZKtJ+TE9FvLwfeD0mXErHj01niLuCjdATFr5P5oXlhYYBqqgxevjH9m1MVOuVL1EOR5jVkn3TOBtfNsmUFbg==");
        req.setAmount(1000.0);
        req.setTransactionPin(RAW_PIN);

        RuntimeException ex = assertThrows(RuntimeException.class, () -> walletService.enable(1L, req));
        assertTrue(ex.getMessage().contains("Insufficient balance"));
    }

    @Test
    void testEnableOfflineWallet_ExceedsMaxEscrow() {
        when(offlineWalletRepo.findByUserIdForUpdate(1L)).thenReturn(Optional.empty());

        EnableOfflineRequest req = new EnableOfflineRequest();
        req.setPublicKey("MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAElBZKtJ+TE9FvLwfeD0mXErHj01niLuCjdATFr5P5oXlhYYBqqgxevjH9m1MVOuVL1EOR5jVkn3TOBtfNsmUFbg==");
        req.setAmount(2500.0); // max is 2000
        req.setTransactionPin(RAW_PIN);

        RuntimeException ex = assertThrows(RuntimeException.class, () -> walletService.enable(1L, req));
        assertTrue(ex.getMessage().contains("exceeds maximum"));
    }

    @Test
    void testTopUp_Success() {
        OfflineWallet wallet = new OfflineWallet();
        wallet.setUserId(1L);
        wallet.setEscrowAmount(500.0);
        wallet.setSpentAmount(100.0);
        wallet.setCertId("cert-1");
        wallet.setExpiry(LocalDateTime.now().plusDays(5));
        wallet.setStatus("ACTIVE");
        wallet.setPublicKey("MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAElBZKtJ+TE9FvLwfeD0mXErHj01niLuCjdATFr5P5oXlhYYBqqgxevjH9m1MVOuVL1EOR5jVkn3TOBtfNsmUFbg==");

        when(offlineWalletRepo.findByUserIdForUpdate(1L)).thenReturn(Optional.of(wallet));

        TopUpOfflineRequest req = new TopUpOfflineRequest();
        req.setAmount(500.0);
        req.setTransactionPin(RAW_PIN);

        OfflineWalletStatusResponse resp = walletService.topUp(1L, req);

        assertEquals(4500.0, sender.getBalance(), 0.01);
        assertEquals(1000.0, wallet.getEscrowAmount(), 0.01);
        assertEquals(900.0, wallet.getRemainingAmount(), 0.01);
        assertTrue(resp.isActive());
        verify(notificationService).pushBalanceUpdate(eq(1L), eq(4500.0));
    }

    @Test
    void testRelease_Success() {
        OfflineWallet wallet = new OfflineWallet();
        wallet.setUserId(1L);
        wallet.setEscrowAmount(1000.0);
        wallet.setSpentAmount(300.0); // 700 remaining
        wallet.setCertId("cert-1");
        wallet.setExpiry(LocalDateTime.now().plusDays(5));
        wallet.setStatus("ACTIVE");

        when(offlineWalletRepo.findByUserIdForUpdate(1L)).thenReturn(Optional.of(wallet));

        ReleaseOfflineRequest req = new ReleaseOfflineRequest();
        req.setTransactionPin(RAW_PIN);

        Map<String, Object> res = walletService.release(1L, req);

        assertEquals(700.0, (double) res.get("releasedAmount"), 0.01);
        assertEquals(5700.0, sender.getBalance(), 0.01);
        assertEquals("REVOKED", wallet.getStatus());
        assertEquals(300.0, wallet.getEscrowAmount(), 0.01); // Remaining reduced to spent
        verify(notificationService).pushBalanceUpdate(eq(1L), eq(5700.0));
    }

    @Test
    void testRevoke_AdminOrUser() {
        OfflineWallet wallet = new OfflineWallet();
        wallet.setUserId(1L);
        wallet.setEscrowAmount(1000.0);
        wallet.setSpentAmount(400.0); // 600 remaining
        wallet.setStatus("ACTIVE");

        when(offlineWalletRepo.findByUserIdForUpdate(1L)).thenReturn(Optional.of(wallet));

        // Revoke by self
        Map<String, Object> res = walletService.revoke(1L, 1L, false);

        assertEquals("REVOKED", res.get("status"));
        assertEquals(600.0, (double) res.get("refundedAmount"), 0.01);
        assertEquals(5600.0, sender.getBalance(), 0.01);
    }

    @Test
    void testRevoke_Unauthorized() {
        // User 2 trying to revoke User 1 without admin
        RuntimeException ex = assertThrows(RuntimeException.class, () -> walletService.revoke(1L, 2L, false));
        assertTrue(ex.getMessage().contains("Unauthorized"));
    }
}

