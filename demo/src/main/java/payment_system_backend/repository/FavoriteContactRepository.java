package payment_system_backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import payment_system_backend.model.FavoriteContact;

import java.util.List;
import java.util.Optional;

public interface FavoriteContactRepository extends JpaRepository<FavoriteContact, Long> {
    List<FavoriteContact> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);
    Optional<FavoriteContact> findByOwnerIdAndContactUserId(Long ownerId, Long contactUserId);
}
