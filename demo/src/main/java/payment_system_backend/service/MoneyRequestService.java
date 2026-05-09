package payment_system_backend.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import payment_system_backend.model.MoneyRequest;
import payment_system_backend.model.User;
import payment_system_backend.repository.MoneyRequestRepository;
import payment_system_backend.repository.UserRepository;

@Service
public class MoneyRequestService {

    @Autowired
    private MoneyRequestRepository moneyRequestRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private TransactionService transactionService;

    @Transactional
    public MoneyRequest createRequest(Long requesterId, Long targetUserId, double amount, String description) {
        if (requesterId.equals(targetUserId)) {
            throw new RuntimeException("You cannot request money from yourself");
        }
        
        User requester = userRepository.findById(requesterId).orElseThrow(() -> new RuntimeException("Requester not found"));
        User targetUser = userRepository.findById(targetUserId).orElseThrow(() -> new RuntimeException("Target user not found"));

        if (amount <= 0) {
            throw new RuntimeException("Amount must be greater than zero");
        }

        MoneyRequest request = new MoneyRequest();
        request.setRequesterId(requesterId);
        request.setTargetUserId(targetUserId);
        request.setAmount(amount);
        request.setDescription(description);
        request.setStatus("PENDING");

        moneyRequestRepository.save(request);

        notificationService.createNotification(targetUserId,
                "📩 Money Request",
                requester.getName() + " requested ₹" + String.format("%.2f", amount) + " from you.",
                "INFO");

        return request;
    }

    @Transactional
    public MoneyRequest acceptRequest(Long requestId, Long targetUserId) {
        MoneyRequest request = moneyRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        if (!request.getTargetUserId().equals(targetUserId)) {
            throw new RuntimeException("Unauthorized to accept this request");
        }

        if (!"PENDING".equals(request.getStatus())) {
            throw new RuntimeException("Only pending requests can be accepted");
        }

        // Execute transaction (Target User pays Requester)
        // TransactionService.sendMoney takes (senderId, receiverId, amount, description)
        String txDescription = "Payment for Request: " + (request.getDescription() != null ? request.getDescription() : "");
        transactionService.sendMoney(targetUserId, request.getRequesterId(), request.getAmount(), txDescription);

        request.setStatus("ACCEPTED");
        moneyRequestRepository.save(request);

        User targetUser = userRepository.findById(targetUserId).orElseThrow();
        notificationService.createNotification(request.getRequesterId(),
                "✅ Request Accepted",
                targetUser.getName() + " paid your request of ₹" + String.format("%.2f", request.getAmount()),
                "SUCCESS");

        return request;
    }

    @Transactional
    public MoneyRequest declineRequest(Long requestId, Long targetUserId) {
        MoneyRequest request = moneyRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        if (!request.getTargetUserId().equals(targetUserId)) {
            throw new RuntimeException("Unauthorized to decline this request");
        }

        if (!"PENDING".equals(request.getStatus())) {
            throw new RuntimeException("Only pending requests can be declined");
        }

        request.setStatus("DECLINED");
        moneyRequestRepository.save(request);

        User targetUser = userRepository.findById(targetUserId).orElseThrow();
        notificationService.createNotification(request.getRequesterId(),
                "❌ Request Declined",
                targetUser.getName() + " declined your request for ₹" + String.format("%.2f", request.getAmount()),
                "ALERT");

        return request;
    }

    @Transactional
    public MoneyRequest cancelRequest(Long requestId, Long requesterId) {
        MoneyRequest request = moneyRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        if (!request.getRequesterId().equals(requesterId)) {
            throw new RuntimeException("Unauthorized to cancel this request");
        }

        if (!"PENDING".equals(request.getStatus())) {
            throw new RuntimeException("Only pending requests can be cancelled");
        }

        request.setStatus("CANCELLED");
        moneyRequestRepository.save(request);
        
        return request;
    }
}
