package payment_system_backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import payment_system_backend.model.Transaction;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    List<Transaction> findBySenderId(Long senderId);
    List<Transaction> findByReceiverId(Long receiverId);

    // For fraud velocity check — recent transactions from sender
    List<Transaction> findBySenderIdAndTimeAfter(Long senderId, LocalDateTime after);

    // For admin — pending refund requests
    List<Transaction> findByRefundStatus(String refundStatus);

    // For analytics — sent transactions within a date range
    List<Transaction> findBySenderIdAndTimeBetween(Long senderId, LocalDateTime from, LocalDateTime to);

    Optional<Transaction> findByGatewayOrderId(String gatewayOrderId);
    Optional<Transaction> findByGatewayPaymentId(String gatewayPaymentId);
}
