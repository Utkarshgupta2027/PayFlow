package payment_system_backend.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import payment_system_backend.entity.Feedback;
import payment_system_backend.request.FeedbackRequest;
import payment_system_backend.service.FeedbackService;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:3000")
public class FeedbackController {

        @Autowired
        private FeedbackService feedbackService;

        @PostMapping("/feedback")
        public ResponseEntity<?> submitFeedback(
                        @RequestBody FeedbackRequest request) {

                try {

                        Feedback saved = feedbackService.submitFeedback(request);

                        return ResponseEntity.status(HttpStatus.CREATED)
                                        .body(Map.of(
                                                        "success", true,
                                                        "message",
                                                        "Thank you for your feedback! We'll get back to you soon.",
                                                        "feedbackId", saved.getId()));

                } catch (IllegalArgumentException ex) {

                        return ResponseEntity.badRequest()
                                        .body(Map.of(
                                                        "success", false,
                                                        "message", ex.getMessage()));

                } catch (Exception ex) {

                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                        .body(Map.of(
                                                        "success", false,
                                                        "message", "Failed to save feedback"));
                }
        }
}