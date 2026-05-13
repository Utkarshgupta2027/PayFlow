package payment_system_backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import payment_system_backend.model.BankAccount;
import payment_system_backend.model.Transaction;
import payment_system_backend.model.User;
import payment_system_backend.repository.BankAccountRepository;
import payment_system_backend.repository.TransactionRepository;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.service.NotificationService;
import payment_system_backend.service.WalletService;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class WalletServiceTest {

    @InjectMocks
    private WalletService walletService;

    @Mock private UserRepository userRepository;
    @Mock private BankAccountRepository bankAccountRepository;
    @Mock private TransactionRepository transactionRepository;
    @Mock private NotificationService notificationService;

    private User user;
    private BankAccount account;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);

        user = new User();
        user.setId(1L);
        user.setName("Alice");
        user.setEmail("alice@test.com");
        user.setBalance(5000);
        user.setFrozen(false);

        account = new BankAccount();
        account.setId(10L);
        account.setUserId(1L);
        account.setBankName("HDFC Bank");
        account.setAccountNumber("XXXX XXXX 1234");
        account.setPrimary(true);

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(transactionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void withdrawToBank_debitsWalletAndRecordsTransaction() {
        when(bankAccountRepository.findByIdAndUserId(10L, 1L)).thenReturn(Optional.of(account));

        Transaction tx = walletService.withdrawToBank(1L, 1200, 10L, "Savings");

        assertEquals(3800, user.getBalance(), 0.01);
        assertEquals("SUCCESS", tx.getStatus());
        assertEquals("WITHDRAWAL", tx.getCategory());
        assertEquals("BANK_TRANSFER", tx.getGatewayProvider());
        assertTrue(tx.getDescription().contains("HDFC Bank"));
        verify(notificationService).pushBalanceUpdate(1L, 3800);
    }

    @Test
    void withdrawToBank_usesPrimaryAccountWhenAccountIdMissing() {
        when(bankAccountRepository.findFirstByUserIdAndPrimaryTrue(1L)).thenReturn(Optional.of(account));

        Transaction tx = walletService.withdrawToBank(1L, 500, null, null);

        assertEquals(4500, user.getBalance(), 0.01);
        assertEquals("WITHDRAWAL", tx.getCategory());
    }

    @Test
    void withdrawToBank_rejectsInsufficientBalance() {
        when(bankAccountRepository.findByIdAndUserId(10L, 1L)).thenReturn(Optional.of(account));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> walletService.withdrawToBank(1L, 6000, 10L, null));

        assertTrue(ex.getMessage().contains("Insufficient wallet balance"));
        assertEquals(5000, user.getBalance(), 0.01);
        verify(transactionRepository, never()).save(any());
    }

    @Test
    void withdrawToBank_rejectsWhenNoBankAccountLinked() {
        when(bankAccountRepository.findFirstByUserIdAndPrimaryTrue(1L)).thenReturn(Optional.empty());
        when(bankAccountRepository.findByUserId(1L)).thenReturn(List.of());

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> walletService.withdrawToBank(1L, 500, null, null));

        assertTrue(ex.getMessage().contains("Link a bank account"));
        verify(transactionRepository, never()).save(any());
    }
}
