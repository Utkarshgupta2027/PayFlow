package payment_system_backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import payment_system_backend.model.SplitParticipant;
import payment_system_backend.model.SplitPayment;
import payment_system_backend.model.User;
import payment_system_backend.repository.SplitPaymentRepository;
import payment_system_backend.repository.UserRepository;

import java.util.List;

@Service
public class SplitPaymentService {

    @Autowired
    private SplitPaymentRepository splitPaymentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TransactionService transactionService;

    @Autowired
    private NotificationService notificationService;

    /**
     * Create a new split payment and divide equally among participants (including creator).
     */
    public SplitPayment createSplit(Long creatorId, String title, double totalAmount,
                                    List<Long> participantIds) {
        if (!participantIds.contains(creatorId)) {
            participantIds.add(0, creatorId);
        }

        double share = totalAmount / participantIds.size();

        SplitPayment split = new SplitPayment();
        split.setTitle(title);
        split.setTotalAmount(totalAmount);
        split.setCreatorId(creatorId);

        for (Long uid : participantIds) {
            User u = userRepository.findById(uid).orElse(null);
            SplitParticipant p = new SplitParticipant();
            p.setSplitPayment(split);
            p.setUserId(uid);
            p.setUserName(u != null ? u.getName() : "Unknown");
            p.setAmountOwed(Math.round(share * 100.0) / 100.0);
            split.getParticipants().add(p);

            // Notify each participant
            if (u != null) {
                notificationService.createNotification(uid,
                        "🔀 Split Request: " + title,
                        "You owe ₹" + String.format("%.2f", share) + " for: " + title,
                        "INFO");
            }
        }

        return splitPaymentRepository.save(split);
    }

    /**
     * Participant pays their share by doing a real wallet transfer to creator.
     */
    public SplitPayment payShare(Long splitId, Long userId) {
        SplitPayment split = splitPaymentRepository.findById(splitId).orElseThrow(() ->
                new RuntimeException("Split not found"));

        SplitParticipant participant = split.getParticipants().stream()
                .filter(p -> p.getUserId().equals(userId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("You are not part of this split"));

        if (participant.isPaid()) {
            throw new RuntimeException("You have already paid your share");
        }

        // Transfer from participant to creator
        transactionService.sendMoney(userId, split.getCreatorId(),
                participant.getAmountOwed(), "Split: " + split.getTitle());

        participant.setAmountPaid(participant.getAmountOwed());
        participant.setPaid(true);

        // Check if all paid
        boolean allPaid = split.getParticipants().stream().allMatch(SplitParticipant::isPaid);
        if (allPaid) {
            split.setStatus("SETTLED");
            notificationService.createNotification(split.getCreatorId(),
                    "🎉 Split Settled: " + split.getTitle(),
                    "All participants have paid their share. Total: ₹" + split.getTotalAmount(),
                    "SUCCESS");
        }

        return splitPaymentRepository.save(split);
    }

    public List<SplitPayment> getSplitsForUser(Long userId) {
        // Return splits created by user OR splits they participate in
        List<SplitPayment> all = splitPaymentRepository.findAll();
        return all.stream()
                .filter(s -> s.getCreatorId().equals(userId) ||
                        s.getParticipants().stream().anyMatch(p -> p.getUserId().equals(userId)))
                .toList();
    }

    public SplitPayment getSplitById(Long splitId) {
        return splitPaymentRepository.findById(splitId)
                .orElseThrow(() -> new RuntimeException("Split not found"));
    }
}
