package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.model.SplitPayment;
import payment_system_backend.service.SplitPaymentService;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/split")
public class SplitPaymentController {

    @Autowired
    private SplitPaymentService splitPaymentService;

    @PostMapping("/create")
    public ResponseEntity<?> createSplit(@RequestBody Map<String, Object> body) {
        try {
            Long creatorId = Long.parseLong(body.get("creatorId").toString());
            String title = body.get("title").toString();
            double totalAmount = Double.parseDouble(body.get("totalAmount").toString());

            @SuppressWarnings("unchecked")
            List<Object> rawIds = (List<Object>) body.get("participantIds");
            List<Long> participantIds = new ArrayList<>(rawIds.stream().map(obj -> Long.parseLong(obj.toString())).toList());

            SplitPayment split = splitPaymentService.createSplit(creatorId, title, totalAmount, participantIds);
            return ResponseEntity.ok(split);
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{splitId}/pay")
    public ResponseEntity<?> payShare(@PathVariable Long splitId,
                                       @RequestParam Long userId) {
        try {
            SplitPayment split = splitPaymentService.payShare(splitId, userId);
            return ResponseEntity.ok(split);
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<SplitPayment>> getSplitsForUser(@PathVariable Long userId) {
        return ResponseEntity.ok(splitPaymentService.getSplitsForUser(userId));
    }

    @GetMapping("/{splitId}")
    public ResponseEntity<?> getSplit(@PathVariable Long splitId) {
        try {
            return ResponseEntity.ok(splitPaymentService.getSplitById(splitId));
        } catch (RuntimeException ex) {
            return ResponseEntity.notFound().build();
        }
    }
}
