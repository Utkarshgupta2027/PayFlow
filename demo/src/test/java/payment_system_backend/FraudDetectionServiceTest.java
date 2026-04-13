package payment_system_backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import payment_system_backend.model.Transaction;
import payment_system_backend.repository.TransactionRepository;
import payment_system_backend.service.FraudDetectionService;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Unit tests for FraudDetectionService rule engine.
 */
class FraudDetectionServiceTest {

    @InjectMocks
    private FraudDetectionService fraudDetectionService;

    @Mock
    private TransactionRepository transactionRepository;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    private Transaction mockTx() {
        Transaction t = new Transaction();
        t.setTime(LocalDateTime.now().minusMinutes(2));
        return t;
    }

    // ─── Rule 1: Velocity ────────────────────────────────────────────────────

    @Test
    void testLowRisk_noRecentTransactions() {
        when(transactionRepository.findBySenderIdAndTimeAfter(eq(1L), any()))
                .thenReturn(List.of());
        FraudDetectionService.RiskAssessment risk = fraudDetectionService.assess(1L, 500, 30);
        assertEquals("LOW", risk.level);
        assertFalse(risk.blocked);
        assertEquals(0.0, risk.score);
    }

    @Test
    void testMediumRisk_highVelocity() {
        List<Transaction> fiveTxns = new ArrayList<>();
        for (int i = 0; i < 5; i++) fiveTxns.add(mockTx());

        when(transactionRepository.findBySenderIdAndTimeAfter(eq(1L), any()))
                .thenReturn(fiveTxns);

        FraudDetectionService.RiskAssessment risk = fraudDetectionService.assess(1L, 100, 30);
        assertEquals("MEDIUM", risk.level);
        assertFalse(risk.blocked);
        assertEquals(40.0, risk.score);
    }

    // ─── Rule 2: Large Amount ─────────────────────────────────────────────────

    @Test
    void testMediumRisk_largeAmount() {
        when(transactionRepository.findBySenderIdAndTimeAfter(eq(1L), any()))
                .thenReturn(List.of());
        FraudDetectionService.RiskAssessment risk = fraudDetectionService.assess(1L, 25_000, 30);
        assertEquals("MEDIUM", risk.level);
        assertEquals(30.0, risk.score);
    }

    // ─── Rule 3: New Account + Large Transfer ─────────────────────────────────

    @Test
    void testHighRisk_newAccountLargeTransfer() {
        when(transactionRepository.findBySenderIdAndTimeAfter(eq(1L), any()))
                .thenReturn(List.of());
        // accountAgeDays < 3 and amount > 5000 → +50 score → HIGH + BLOCKED
        FraudDetectionService.RiskAssessment risk = fraudDetectionService.assess(1L, 10_000, 1);
        assertEquals("HIGH", risk.level);
        assertTrue(risk.blocked);
        assertTrue(risk.score >= 70);
    }

    // ─── Rule 4: Round Number ─────────────────────────────────────────────────

    @Test
    void testRoundNumberAddsScore() {
        when(transactionRepository.findBySenderIdAndTimeAfter(eq(1L), any()))
                .thenReturn(List.of());
        // amount % 1000 == 0 && amount > 10000 → +10
        FraudDetectionService.RiskAssessment risk = fraudDetectionService.assess(1L, 15_000, 30);
        assertTrue(risk.score >= 10); // at least +30 (large) + +10 (round) = 40
        assertEquals("MEDIUM", risk.level);
    }

    // ─── Combined HIGH risk ───────────────────────────────────────────────────

    @Test
    void testHighRisk_velocityPlusLargeAmount() {
        List<Transaction> sixTxns = new ArrayList<>();
        for (int i = 0; i < 6; i++) sixTxns.add(mockTx());

        when(transactionRepository.findBySenderIdAndTimeAfter(eq(1L), any()))
                .thenReturn(sixTxns);

        FraudDetectionService.RiskAssessment risk = fraudDetectionService.assess(1L, 25_000, 30);
        assertEquals("HIGH", risk.level);
        assertTrue(risk.blocked);
        assertEquals(70.0, risk.score); // 40 + 30
    }

    // ─── No fraud for normal transaction ─────────────────────────────────────

    @Test
    void testNormalTransaction_noFraud() {
        when(transactionRepository.findBySenderIdAndTimeAfter(eq(1L), any()))
                .thenReturn(List.of());
        FraudDetectionService.RiskAssessment risk = fraudDetectionService.assess(1L, 200, 60);
        assertEquals("LOW", risk.level);
        assertFalse(risk.blocked);
        assertEquals(0, risk.score);
    }
}
