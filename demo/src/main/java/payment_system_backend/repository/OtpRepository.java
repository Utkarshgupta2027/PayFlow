package payment_system_backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import payment_system_backend.model.OtpRecord;

import java.util.List;

public interface OtpRepository extends JpaRepository<OtpRecord, Long> {
    List<OtpRecord> findByPhoneNumberOrderByCreatedAtDesc(String phoneNumber);
}
