package payment_system_backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import payment_system_backend.model.Reward;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RewardRepository extends JpaRepository<Reward, Long> {

    List<Reward> findByUserIdOrderByDateDesc(Long userId);

    @Query("SELECT COALESCE(SUM(r.points), 0) FROM Reward r WHERE r.userId = :userId")
    int sumPointsByUserId(Long userId);

    Optional<Reward> findByUserIdAndSourceAndDate(Long userId, String source, LocalDate date);
}
