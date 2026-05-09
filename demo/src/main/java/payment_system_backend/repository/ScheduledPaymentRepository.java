package payment_system_backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import payment_system_backend.model.ScheduledPayment;

import java.time.LocalDate;
import java.util.List;

public interface ScheduledPaymentRepository extends JpaRepository<ScheduledPayment, Long> {
    List<ScheduledPayment> findBySenderIdOrderByCreatedAtDesc(Long senderId);
    List<ScheduledPayment> findByStatusAndNextRunDateLessThanEqual(String status, LocalDate date);
}
