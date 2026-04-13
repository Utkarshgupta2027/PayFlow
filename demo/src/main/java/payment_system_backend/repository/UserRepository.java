package payment_system_backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import payment_system_backend.model.User;

import java.util.List;

public interface UserRepository extends JpaRepository<User, Long> {
    User findByEmail(String email);
    User findByPhoneNumber(String phoneNumber);
    User findByReferralCode(String referralCode);
    List<User> findByRole(String role);
    List<User> findByFrozen(boolean frozen);
}