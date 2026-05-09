package payment_system_backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import payment_system_backend.model.MoneyRequest;

import java.util.List;

@Repository
public interface MoneyRequestRepository extends JpaRepository<MoneyRequest, Long> {
    List<MoneyRequest> findByTargetUserIdOrderByCreatedAtDesc(Long targetUserId);
    List<MoneyRequest> findByRequesterIdOrderByCreatedAtDesc(Long requesterId);
    List<MoneyRequest> findByTargetUserIdAndStatusOrderByCreatedAtDesc(Long targetUserId, String status);
}
