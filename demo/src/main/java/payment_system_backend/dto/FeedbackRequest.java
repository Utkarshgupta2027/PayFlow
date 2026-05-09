package payment_system_backend.dto;

import lombok.Data;

@Data
public class FeedbackRequest {
    private String name;
    private String email;
    private String subject;
    private String message;
    private Integer rating;
}
