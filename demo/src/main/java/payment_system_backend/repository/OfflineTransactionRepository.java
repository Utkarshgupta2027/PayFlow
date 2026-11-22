package payment_system_backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import payment_system_backend.model.OfflineTransaction;

import java.util.List;
import java.util.Optional;

@Repository
public interface OfflineTransactionRepository extends JpaRepository<OfflineTransaction, Long> {

    Optional<OfflineTransaction> findByTokenId(String tokenId);

    boolean existsByTokenId(String tokenId);

    List<OfflineTransaction> findByCertId(String certId);

    List<OfflineTransaction> findBySenderId(Long senderId);

    List<OfflineTransaction> findByReceiverId(Long receiverId);

    @Query("SELECT COALESCE(MAX(t.counter), 0) FROM OfflineTransaction t WHERE t.certId = :certId AND t.status = 'SETTLED'")
    long findMaxCounterByCertId(@Param("certId") String certId);
}

