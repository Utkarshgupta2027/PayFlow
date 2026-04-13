package payment_system_backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import payment_system_backend.model.SplitPayment;

import java.util.List;

public interface SplitPaymentRepository extends JpaRepository<SplitPayment, Long> {

    List<SplitPayment> findByCreatorId(Long creatorId);
}
