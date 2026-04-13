package payment_system_backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
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

    /**
     * Sends an email. Fails silently if SMTP is not configured.
     */
    public void sendEmail(String to, String subject, String body) {
        if (mailSender == null || to == null || to.isBlank()) return;
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setTo(to);
            msg.setSubject(subject);
            msg.setText(body);
            mailSender.send(msg);
        } catch (Exception e) {
            // Log but don't crash — SMTP may not be configured
            System.err.println("[NotificationService] Email send failed: " + e.getMessage());
        }
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
