package payment_system_backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import payment_system_backend.model.Notification;
import payment_system_backend.repository.NotificationRepository;
import payment_system_backend.repository.UserRepository;

import java.util.List;

@Service
public class NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Autowired
    private UserRepository userRepository;

    @Value("${spring.mail.username:}")
    private String fromEmail;

    /**
     * Creates a persistent in-app notification AND pushes it to the user's
     * WebSocket session in real time.
     */
    public Notification createNotification(Long userId, String title, String message, String type) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setTitle(title);
        n.setMessage(message);
        n.setType(type != null ? type : "INFO");
        Notification saved = notificationRepository.save(n);

        // Push via WebSocket to /user/{email}/topic/notifications
        try {
            userRepository.findById(userId).ifPresent(user -> {
                messagingTemplate.convertAndSendToUser(
                    user.getEmail(),
                    "/topic/notifications",
                    saved
                );
            });
        } catch (Exception ignored) {
            // WebSocket push is best-effort
        }

        return saved;
    }

    /**
     * Push a live balance update to a specific user via WebSocket.
     */
    public void pushBalanceUpdate(Long userId, double newBalance) {
        try {
            userRepository.findById(userId).ifPresent(user ->
                messagingTemplate.convertAndSendToUser(
                    user.getEmail(),
                    "/topic/balance",
                    java.util.Map.of("balance", newBalance, "userId", userId)
                )
            );
        } catch (Exception ignored) {}
    }

    public void sendEmail(String to, String subject, String body) {
        sendEmail(to, subject, body, null);
    }

    /**
     * Sends an email with an optional replyTo address.
     */
    public void sendEmail(String to, String subject, String body, String replyTo) {
        if (mailSender == null || to == null || to.isBlank()) return;
        try {
            sendEmailOrThrow(to, subject, body, replyTo);
        } catch (Exception e) {
            // Log but don't crash — SMTP may not be configured
            System.err.println("[NotificationService] Email send failed: " + e.getMessage());
        }
    }

    public void sendEmailOrThrow(String to, String subject, String body) throws Exception {
        sendEmailOrThrow(to, subject, body, null);
    }

    public void sendEmailOrThrow(String to, String subject, String body, String replyTo) throws Exception {
        if (mailSender == null) {
            throw new IllegalStateException("Mail sender is not configured");
        }
        if (fromEmail == null || fromEmail.isBlank()) {
            throw new IllegalStateException("MAIL_USER is not configured");
        }
        if (to == null || to.isBlank()) {
            throw new IllegalArgumentException("Recipient email is required");
        }

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(body, false); // false = plain text
        helper.setFrom(fromEmail, "PayFlow");

        if (replyTo != null && !replyTo.isBlank()) {
            helper.setReplyTo(replyTo);
        }

        mailSender.send(message);
    }

    public List<Notification> getNotifications(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    public void markAsRead(Long notificationId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setRead(true);
            notificationRepository.save(n);
        });
    }

    public void markAllAsRead(Long userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndReadFalse(userId);
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
    }
}
