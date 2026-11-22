package payment_system_backend.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import payment_system_backend.model.OfflineWallet;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface OfflineWalletRepository extends JpaRepository<OfflineWallet, Long> {

    Optional<OfflineWallet> findByUserId(Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM OfflineWallet w WHERE w.userId = :userId")
    Optional<OfflineWallet> findByUserIdForUpdate(@Param("userId") Long userId);

    Optional<OfflineWallet> findByCertId(String certId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM OfflineWallet w WHERE w.certId = :certId")
    Optional<OfflineWallet> findByCertIdForUpdate(@Param("certId") String certId);

    boolean existsByUserId(Long userId);

    List<OfflineWallet> findByStatusAndExpiryBefore(String status, LocalDateTime expiry);
}

