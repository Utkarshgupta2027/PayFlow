package payment_system_backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import payment_system_backend.model.Transaction;
import payment_system_backend.model.User;
import payment_system_backend.repository.TransactionRepository;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.service.FraudDetectionService;
import payment_system_backend.service.NotificationService;
import payment_system_backend.service.TransactionService;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TransactionServiceTest {

    @InjectMocks
    private TransactionService transactionService;

    @Mock private TransactionRepository transactionRepo;
    @Mock private UserRepository userRepository;
    @Mock private FraudDetectionService fraudDetectionService;
    @Mock private NotificationService notificationService;

    private User sender;
    private User receiver;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);

        sender = new User();
        sender.setId(1L);
        sender.setName("Alice");
        sender.setEmail("alice@test.com");
        sender.setBalance(5000);
        sender.setFrozen(false);
        sender.setAccountAgeDays(60);

        receiver = new User();
        receiver.setId(2L);
        receiver.setName("Bob");
        receiver.setEmail("bob@test.com");
        receiver.setBalance(1000);
        receiver.setFrozen(false);

        when(userRepository.findById(1L)).thenReturn(Optional.of(sender));
        when(userRepository.findById(2L)).thenReturn(Optional.of(receiver));
        when(userRepository.findByRole("ADMIN")).thenReturn(List.of());
        when(transactionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void testSuccessfulTransfer() {
        when(fraudDetectionService.assess(eq(1L), eq(500.0), anyInt()))
                .thenReturn(new FraudDetectionService.RiskAssessment(0, "LOW", false, "None"));

        Transaction tx = transactionService.sendMoney(1L, 2L, 500.0);

        assertEquals(4500, sender.getBalance(), 0.01);
        assertEquals(1500, receiver.getBalance(), 0.01);
        assertEquals("SUCCESS", tx.getStatus());
        assertEquals("LOW", tx.getRiskLevel());
    }

    @Test
    void testInsufficientBalance() {
        when(fraudDetectionService.assess(anyLong(), anyDouble(), anyInt()))
                .thenReturn(new FraudDetectionService.RiskAssessment(0, "LOW", false, "None"));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> transactionService.sendMoney(1L, 2L, 10_000.0));

        assertTrue(ex.getMessage().contains("Insufficient balance"));
        assertEquals(5000, sender.getBalance(), 0.01); // unchanged
    }

    @Test
    void testFraudBlocked_accountFrozen() {
        when(fraudDetectionService.assess(anyLong(), anyDouble(), anyInt()))
                .thenReturn(new FraudDetectionService.RiskAssessment(80, "HIGH", true, "High velocity"));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> transactionService.sendMoney(1L, 2L, 500.0));

        assertTrue(ex.getMessage().contains("blocked"));
        assertTrue(sender.isFrozen()); // account was frozen
        assertEquals(5000, sender.getBalance(), 0.01); // balance unchanged
    }

    @Test
    void testFlaggedTransaction_mediumRisk() {
        when(fraudDetectionService.assess(anyLong(), anyDouble(), anyInt()))
                .thenReturn(new FraudDetectionService.RiskAssessment(50, "MEDIUM", false, "Large amount"));

        Transaction tx = transactionService.sendMoney(1L, 2L, 500.0);
        assertEquals("FLAGGED", tx.getStatus()); // flagged but allowed
    }

    @Test
    void testFrozenSenderBlocked() {
        sender.setFrozen(true);

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> transactionService.sendMoney(1L, 2L, 100.0));

        assertTrue(ex.getMessage().contains("frozen"));
        verify(fraudDetectionService, never()).assess(anyLong(), anyDouble(), anyInt());
    }

    @Test
    void testRefundRequest() {
        Transaction tx = new Transaction();
        tx.setSenderId(1L);
        tx.setReceiverId(2L);
        tx.setAmount(500);
        tx.setStatus("SUCCESS");

        when(transactionRepo.findById(10L)).thenReturn(Optional.of(tx));
        when(transactionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Transaction result = transactionService.requestRefund(10L, 1L);
        assertEquals("PENDING", result.getRefundStatus());
    }
}
