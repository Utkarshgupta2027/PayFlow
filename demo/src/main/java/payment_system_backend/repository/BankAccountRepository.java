package payment_system_backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import payment_system_backend.model.BankAccount;

import java.util.List;
import java.util.Optional;

public interface BankAccountRepository extends JpaRepository<BankAccount, Long> {
    List<BankAccount> findByUserId(Long userId);
    Optional<BankAccount> findByIdAndUserId(Long id, Long userId);
    Optional<BankAccount> findFirstByUserIdAndPrimaryTrue(Long userId);
    boolean existsByAccountNumberFull(String accountNumberFull);
}
