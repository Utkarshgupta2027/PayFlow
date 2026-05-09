package payment_system_backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import payment_system_backend.model.Feedback;
import payment_system_backend.repository.FeedbackRepository;
import payment_system_backend.dto.FeedbackRequest;

@Service
public class FeedbackService {

    @Autowired
    private FeedbackRepository feedbackRepository;

    @Autowired
    private NotificationService notificationService;

    @Value("${spring.mail.username}")
    private String adminEmail;

    public Feedback submitFeedback(FeedbackRequest req) {

        // 1. Validation

        if (req.getName() == null || req.getName().isBlank()) {
            throw new IllegalArgumentException("Name is required.");
        }

        if (req.getEmail() == null || req.getEmail().isBlank()) {
            throw new IllegalArgumentException("Email is required.");
        }

        if (req.getSubject() == null || req.getSubject().isBlank()) {
            throw new IllegalArgumentException("Subject is required.");
        }

        if (req.getMessage() == null || req.getMessage().isBlank()) {
            throw new IllegalArgumentException("Message is required.");
        }

        // 2. Save Feedback

        Feedback feedback = new Feedback();

        feedback.setName(req.getName());
        feedback.setEmail(req.getEmail());
        feedback.setSubject(req.getSubject());
        feedback.setMessage(req.getMessage());
        feedback.setRating(req.getRating());

        Feedback saved = feedbackRepository.save(feedback);

        // 3. Send Mail To Admin

        try {
            sendAdminNotification(saved);
        } catch (Exception e) {
            System.err.println(
                    "Failed to send admin email: "
                            + e.getMessage());
        }

        // 4. Send Confirmation To User

        try {
            sendUserConfirmation(saved);
        } catch (Exception e) {
            System.err.println(
                    "Failed to send user confirmation: "
                            + e.getMessage());
        }

        return saved;
    }

    // ADMIN MAIL

    private void sendAdminNotification(Feedback fb) {

        if (adminEmail == null || adminEmail.isBlank()) {
            return;
        }

        String ratingLine = fb.getRating() != null
                ? "Rating : "
                        + "★".repeat(fb.getRating())
                        + " (" + fb.getRating() + "/5)\n"
                : "";

        String body = "NEW FEEDBACK RECEIVED\n\n"

                + "Name : " + fb.getName() + "\n"
                + "Email : " + fb.getEmail() + "\n"
                + "Subject : " + fb.getSubject() + "\n"
                + ratingLine + "\n"

                + "Message:\n"
                + fb.getMessage() + "\n\n"

                + "Feedback ID : #" + fb.getId();

        notificationService.sendEmail(
            adminEmail, 
            "PayFlow feedback: " + fb.getSubject(), 
            body,
            fb.getEmail()
        );
    }

    // USER CONFIRMATION MAIL

    private void sendUserConfirmation(Feedback fb) {

        if (adminEmail == null || adminEmail.isBlank()) {
            return;
        }

        String body = "Hi " + fb.getName() + ",\n\n"

                + "Thank you for your feedback.\n\n"

                + "We received your message successfully.\n\n"

                + "Reference ID : #" + fb.getId() + "\n\n"

                + "We will contact you soon.\n\n"

                + "Regards,\n"
                + "Payment System Team";

        notificationService.sendEmail(
            fb.getEmail(), 
            "Feedback Received Successfully", 
            body
        );
    }
}