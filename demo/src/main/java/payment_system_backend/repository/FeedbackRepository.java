package payment_system_backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import payment_system_backend.model.Feedback;

public interface FeedbackRepository
        extends JpaRepository<Feedback, Long> {

}