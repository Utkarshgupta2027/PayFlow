package payment_system_backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.test.util.ReflectionTestUtils;
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
import payment_system_backend.service.NotificationService;
import payment_system_backend.service.OfflineCryptoService;
import payment_system_backend.service.OfflineSettlementService;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.spec.ECGenParameterSpec;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class OfflineSettlementServiceTest {

    @InjectMocks
    private OfflineSettlementService settlementService;

    @Mock private OfflineWalletRepository offlineWalletRepo;
    @Mock private OfflineTransactionRepository offlineTxRepo;
    @Mock private UserRepository userRepository;
    @Mock private TransactionRepository transactionRepo;
    @Mock private NotificationService notificationService;

    private OfflinePaymentConfig config;
    private OfflineCryptoService cryptoService;

    private User sender;
    private User receiver;
    private OfflineWallet wallet;
    private KeyPair senderKeyPair;
    private String senderPublicKeyBase64;

    @BeforeEach
    void setUp() throws Exception {
        MockitoAnnotations.openMocks(this);

        config = new OfflinePaymentConfig();
        ReflectionTestUtils.setField(config, "maxPerTransaction", 500.0);
        ReflectionTestUtils.setField(config, "maxEscrow", 2000.0);
        ReflectionTestUtils.setField(config, "certificateValidityDays", 7);

        cryptoService = new OfflineCryptoService();
        ReflectionTestUtils.setField(cryptoService, "config", config);
        cryptoService.init();

        ReflectionTestUtils.setField(settlementService, "config", config);
        ReflectionTestUtils.setField(settlementService, "cryptoService", cryptoService);

        // Generate EC key pair for sender device
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC");
        kpg.initialize(new ECGenParameterSpec("secp256r1"));
        senderKeyPair = kpg.generateKeyPair();
        senderPublicKeyBase64 = Base64.getEncoder().encodeToString(senderKeyPair.getPublic().getEncoded());

        sender = new User();
        sender.setId(1L);
        sender.setName("Alice");
        sender.setEmail("alice@test.com");
        sender.setBalance(4000.0);

        receiver = new User();
        receiver.setId(2L);
        receiver.setName("Bob");
        receiver.setEmail("bob@test.com");
        receiver.setBalance(100.0);

        wallet = new OfflineWallet();
        wallet.setId(10L);
        wallet.setUserId(1L);
        wallet.setCertId("cert-101");
        wallet.setPublicKey(senderPublicKeyBase64);
        wallet.setEscrowAmount(1000.0);
        wallet.setSpentAmount(0.0);
        wallet.setExpiry(LocalDateTime.now().plusDays(5));
        wallet.setStatus("ACTIVE");

        when(userRepository.findById(1L)).thenReturn(Optional.of(sender));
        when(userRepository.findById(2L)).thenReturn(Optional.of(receiver));
        when(offlineWalletRepo.findByCertIdForUpdate("cert-101")).thenReturn(Optional.of(wallet));
        when(offlineTxRepo.save(any(OfflineTransaction.class))).thenAnswer(inv -> inv.getArgument(0));
        when(transactionRepo.save(any(Transaction.class))).thenAnswer(inv -> inv.getArgument(0));
        when(offlineWalletRepo.save(any(OfflineWallet.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private OfflineTokenDto createSignedToken(String tokenId, double amount, long counter) {
        OfflineTokenDto token = new OfflineTokenDto();
        token.setTokenId(tokenId);
        token.setCertId("cert-101");
        token.setSenderId(1L);
        token.setReceiverId(2L);
        token.setAmount(amount);
        token.setCounter(counter);
        token.setTimestamp(System.currentTimeMillis());

        String canonical = cryptoService.canonicalTokenString(
                tokenId, "cert-101", 1L, 2L, amount, counter, token.getTimestamp()
        );
        byte[] sigBytes = cryptoService.signData(canonical.getBytes(StandardCharsets.UTF_8), senderKeyPair.getPrivate());
        token.setSignature(Base64.getEncoder().encodeToString(sigBytes));
        return token;
    }

    @Test
    void testSuccessfulSettlement() {
        OfflineTokenDto token = createSignedToken("tok-100", 250.0, 1L);
        when(offlineTxRepo.findByTokenId("tok-100")).thenReturn(Optional.empty());
        when(offlineTxRepo.findMaxCounterByCertId("cert-101")).thenReturn(0L);

        OfflineSyncResponse.TokenResult result = settlementService.settleSingleToken(token);

        assertEquals("SETTLED", result.getStatus());
        assertEquals(250.0, wallet.getSpentAmount(), 0.01);
        assertEquals(350.0, receiver.getBalance(), 0.01); // 100 + 250

        // Verify main transaction saved with category OFFLINE
        verify(transactionRepo).save(argThat(tx ->
                tx.getCategory().equals("OFFLINE") &&
                tx.getAmount() == 250.0 &&
                tx.getSenderId().equals(1L) &&
                tx.getReceiverId().equals(2L)
        ));

        // Verify notifications & balance update
        verify(notificationService).pushBalanceUpdate(eq(2L), eq(350.0));
        verify(notificationService).createNotification(eq(1L), anyString(), anyString(), eq("SUCCESS"));
        verify(notificationService).createNotification(eq(2L), anyString(), anyString(), eq("SUCCESS"));
    }

    @Test
    void testDuplicateToken_Idempotent() {
        OfflineTokenDto token = createSignedToken("tok-duplicate", 150.0, 1L);

        OfflineTransaction existingTx = new OfflineTransaction();
        existingTx.setTokenId("tok-duplicate");
        existingTx.setStatus("SETTLED");
        when(offlineTxRepo.findByTokenId("tok-duplicate")).thenReturn(Optional.of(existingTx));

        OfflineSyncResponse.TokenResult result = settlementService.settleSingleToken(token);

        assertEquals("DUPLICATE", result.getStatus());
        assertEquals(0.0, wallet.getSpentAmount()); // Unchanged
        assertEquals(100.0, receiver.getBalance()); // Unchanged
        verify(transactionRepo, never()).save(any());
    }

    @Test
    void testTamperedSignature_Rejected() {
        OfflineTokenDto token = createSignedToken("tok-tampered", 200.0, 1L);
        token.setAmount(499.0); // Tamper amount without updating signature
        when(offlineTxRepo.findByTokenId("tok-tampered")).thenReturn(Optional.empty());

        OfflineSyncResponse.TokenResult result = settlementService.settleSingleToken(token);

        assertEquals("REJECTED", result.getStatus());
        assertTrue(result.getReason().contains("signature"));
        assertEquals(0.0, wallet.getSpentAmount());
        assertEquals(100.0, receiver.getBalance());
    }

    @Test
    void testCounterReplay_Rejected() {
        OfflineTokenDto token = createSignedToken("tok-replay", 100.0, 2L);
        when(offlineTxRepo.findByTokenId("tok-replay")).thenReturn(Optional.empty());
        // Last settled counter is already 2
        when(offlineTxRepo.findMaxCounterByCertId("cert-101")).thenReturn(2L);

        OfflineSyncResponse.TokenResult result = settlementService.settleSingleToken(token);

        assertEquals("REJECTED", result.getStatus());
        assertTrue(result.getReason().contains("Counter replay"));
        assertEquals(0.0, wallet.getSpentAmount());
    }

    @Test
    void testEscrowExceeded_Rejected() {
        wallet.setSpentAmount(800.0); // Only 200 remaining out of 1000
        OfflineTokenDto token = createSignedToken("tok-exceeded", 300.0, 1L);
        when(offlineTxRepo.findByTokenId("tok-exceeded")).thenReturn(Optional.empty());
        when(offlineTxRepo.findMaxCounterByCertId("cert-101")).thenReturn(0L);

        OfflineSyncResponse.TokenResult result = settlementService.settleSingleToken(token);

        assertEquals("REJECTED", result.getStatus());
        assertTrue(result.getReason().contains("Escrow balance exceeded"));
        assertEquals(800.0, wallet.getSpentAmount());
    }

    @Test
    void testExpiredCertificate_Rejected() {
        wallet.setExpiry(LocalDateTime.now().minusHours(1)); // Expired 1 hour ago
        OfflineTokenDto token = createSignedToken("tok-expired", 100.0, 1L);
        when(offlineTxRepo.findByTokenId("tok-expired")).thenReturn(Optional.empty());

        OfflineSyncResponse.TokenResult result = settlementService.settleSingleToken(token);

        assertEquals("REJECTED", result.getStatus());
        assertTrue(result.getReason().contains("expired"));
        assertEquals(0.0, wallet.getSpentAmount());
    }

    @Test
    void testRevokedWallet_Rejected() {
        wallet.setStatus("REVOKED");
        OfflineTokenDto token = createSignedToken("tok-revoked", 100.0, 1L);
        when(offlineTxRepo.findByTokenId("tok-revoked")).thenReturn(Optional.empty());

        OfflineSyncResponse.TokenResult result = settlementService.settleSingleToken(token);

        assertEquals("REJECTED", result.getStatus());
        assertTrue(result.getReason().contains("not active"));
        assertEquals(0.0, wallet.getSpentAmount());
    }

    @Test
    void testConcurrentSettlement_ProtectsEscrowBalance() throws Exception {
        // Escrow total = 500, current spent = 0.
        // We simulate 4 concurrent threads, each attempting to settle ₹200.
        // At most 2 should succeed (2 * 200 = 400 <= 500); the rest MUST fail escrow check.
        wallet.setEscrowAmount(500.0);
        wallet.setSpentAmount(0.0);

        int numThreads = 4;
        ExecutorService executor = Executors.newFixedThreadPool(numThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(numThreads);

        AtomicInteger settledCount = new AtomicInteger(0);
        AtomicInteger rejectedCount = new AtomicInteger(0);

        // Synchronize on wallet to simulate pessimistic locking behavior
        when(offlineWalletRepo.findByCertIdForUpdate("cert-101")).thenAnswer(inv -> {
            return Optional.of(wallet);
        });

        for (int i = 0; i < numThreads; i++) {
            final int idx = i + 1;
            final OfflineTokenDto tok = createSignedToken("tok-concurrent-" + idx, 200.0, (long) idx);

            executor.submit(() -> {
                try {
                    startLatch.await();
                    // In real DB, findByCertIdForUpdate locks row in DB.
                    // Here we synchronize on wallet monitor to model DB row lock.
                    OfflineSyncResponse.TokenResult res;
                    synchronized (wallet) {
                        when(offlineTxRepo.findMaxCounterByCertId("cert-101"))
                                .thenReturn((long) (settledCount.get()));
                        res = settlementService.settleSingleToken(tok);
                    }
                    if ("SETTLED".equals(res.getStatus())) {
                        settledCount.incrementAndGet();
                    } else {
                        rejectedCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    rejectedCount.incrementAndGet();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        assertTrue(doneLatch.await(5, TimeUnit.SECONDS));
        executor.shutdown();

        // Total spent cannot exceed 500.0!
        assertTrue(wallet.getSpentAmount() <= 500.0, "Wallet spent amount (" + wallet.getSpentAmount() + ") must not exceed escrow (500.0)");
        assertEquals(2, settledCount.get(), "Exactly 2 payments of ₹200 should settle within ₹500 escrow");
        assertEquals(2, rejectedCount.get(), "The other 2 payments must be rejected");
    }
}

