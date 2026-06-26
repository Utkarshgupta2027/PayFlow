package payment_system_backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import payment_system_backend.model.Notification;
import payment_system_backend.repository.NotificationRepository;
import payment_system_backend.repository.UserRepository;

import java.util.List;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import java.util.Map;
import java.util.HashMap;

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

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    @Value("${brevo.api.key:}")
    private String brevoApiKey;

    @Value("${brevo.sender.email:}")
    private String brevoSenderEmail;

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
        if (to == null || to.isBlank()) return;
        if (mailSender == null && effectiveBrevoApiKey().isBlank()) return;
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
        String effectiveBrevoApiKey = effectiveBrevoApiKey();
        if (!effectiveBrevoApiKey.isBlank()) {
            sendViaBrevoApi(to, subject, body, null, replyTo, null);
            return;
        }
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

    @Async
    public void sendEmailAsync(String to, String subject, String body) {
        try {
            sendEmailOrThrow(to, subject, body);
        } catch (Exception e) {
            System.err.println("[NotificationService] Async email send failed for " + to + ": " + e.getMessage());
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

    private void sendViaBrevoApi(String toEmail, String subject, String textContent, String htmlContent, String replyToEmail, List<Map<String, Object>> attachments) {
        RestTemplate restTemplate = new RestTemplate();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("api-key", effectiveBrevoApiKey());

        Map<String, Object> sender = new HashMap<>();
        sender.put("name", "PayFlow");
        String senderEmail = (brevoSenderEmail != null && !brevoSenderEmail.isBlank()) ? brevoSenderEmail : fromEmail;
        if (senderEmail == null || senderEmail.isBlank()) {
            senderEmail = "noreply@payflow.com";
        }
        sender.put("email", senderEmail);

        Map<String, String> recipient = new HashMap<>();
        recipient.put("email", toEmail);

        Map<String, Object> body = new HashMap<>();
        body.put("sender", sender);
        body.put("to", List.of(recipient));
        body.put("subject", subject);
        if (textContent != null) {
            body.put("textContent", textContent);
        }
        if (htmlContent != null) {
            body.put("htmlContent", htmlContent);
        }
        if (replyToEmail != null && !replyToEmail.isBlank()) {
            Map<String, String> replyTo = new HashMap<>();
            replyTo.put("email", replyToEmail);
            body.put("replyTo", replyTo);
        }
        if (attachments != null && !attachments.isEmpty()) {
            body.put("attachment", attachments);
        }

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        try {
            restTemplate.postForObject("https://api.brevo.com/v3/smtp/email", request, String.class);
        } catch (Exception e) {
            System.err.println("[NotificationService] Failed to send Brevo HTTP email to " + toEmail + ": " + e.getMessage());
            throw new RuntimeException("Brevo API send failed: " + e.getMessage(), e);
        }
    }

    private String effectiveBrevoApiKey() {
        if (brevoApiKey != null && !brevoApiKey.isBlank()) {
            return brevoApiKey.trim();
        }
        if (isBrevoSmtpHost() && mailPassword != null && !mailPassword.isBlank()) {
            return mailPassword.trim();
        }
        return "";
    }

    private boolean isBrevoSmtpHost() {
        return mailHost != null && mailHost.toLowerCase().contains("brevo");
    }

    public void markAllAsRead(Long userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndReadFalse(userId);
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
    }
}
