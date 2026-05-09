package payment_system_backend.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import payment_system_backend.model.ScheduledPayment;
import payment_system_backend.model.Transaction;
import payment_system_backend.model.User;
import payment_system_backend.repository.ScheduledPaymentRepository;
import payment_system_backend.repository.TransactionRepository;
import payment_system_backend.repository.UserRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;

@Service
public class ScheduledPaymentService {

    @Autowired
    private ScheduledPaymentRepository scheduledPaymentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TransactionService transactionService;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private NotificationService notificationService;

    public List<ScheduledPayment> listForUser(Long userId) {
        return scheduledPaymentRepository.findBySenderIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public ScheduledPayment create(Long senderId, Long receiverId, double amount, String title,
                                   String description, String frequency, Integer dayOfMonth,
                                   Integer dayOfWeek, LocalDate startDate) {
        if (amount <= 0) {
            throw new RuntimeException("Amount must be greater than 0");
        }
        if (senderId.equals(receiverId)) {
            throw new RuntimeException("Cannot schedule a payment to yourself");
        }

        userRepository.findById(senderId).orElseThrow(() -> new RuntimeException("Sender not found"));
        userRepository.findById(receiverId).orElseThrow(() -> new RuntimeException("Receiver not found"));

        String normalizedFrequency = normalizeFrequency(frequency);
        LocalDate nextRunDate = calculateFirstRun(normalizedFrequency, dayOfMonth, dayOfWeek, startDate);

        ScheduledPayment schedule = new ScheduledPayment();
        schedule.setSenderId(senderId);
        schedule.setReceiverId(receiverId);
        schedule.setAmount(amount);
        schedule.setTitle(title == null || title.isBlank() ? "Recurring payment" : title.trim());
        schedule.setDescription(description);
        schedule.setFrequency(normalizedFrequency);
        schedule.setDayOfMonth("MONTHLY".equals(normalizedFrequency) ? dayOfMonth : null);
        schedule.setDayOfWeek("WEEKLY".equals(normalizedFrequency) ? dayOfWeek : null);
        schedule.setNextRunDate(nextRunDate);
        schedule.setStatus("ACTIVE");
        schedule.setCreatedAt(LocalDateTime.now());
        schedule.setUpdatedAt(LocalDateTime.now());
        return scheduledPaymentRepository.save(schedule);
    }

    @Transactional
    public ScheduledPayment updateStatus(Long scheduleId, Long userId, String status) {
        ScheduledPayment schedule = getOwnedSchedule(scheduleId, userId);
        String nextStatus = status == null ? "" : status.toUpperCase();
        if (!List.of("ACTIVE", "PAUSED", "CANCELLED").contains(nextStatus)) {
            throw new RuntimeException("Unsupported schedule status");
        }
        schedule.setStatus(nextStatus);
        schedule.setUpdatedAt(LocalDateTime.now());
        return scheduledPaymentRepository.save(schedule);
    }

    @Transactional
    public void delete(Long scheduleId, Long userId) {
        ScheduledPayment schedule = getOwnedSchedule(scheduleId, userId);
        scheduledPaymentRepository.delete(schedule);
    }

    @Scheduled(cron = "0 * * * * *")
    public void runDuePayments() {
        runDuePayments(LocalDate.now());
    }

    public void runDuePayments(LocalDate today) {
        List<ScheduledPayment> duePayments =
                scheduledPaymentRepository.findByStatusAndNextRunDateLessThanEqual("ACTIVE", today);

        for (ScheduledPayment schedule : duePayments) {
            try {
                executeSchedule(schedule, today);
            } catch (RuntimeException ex) {
                schedule.setLastFailureReason(ex.getMessage());
                schedule.setUpdatedAt(LocalDateTime.now());
                scheduledPaymentRepository.save(schedule);
                notificationService.createNotification(schedule.getSenderId(),
                        "Scheduled Payment Failed",
                        schedule.getTitle() + " could not be paid: " + ex.getMessage(),
                        "ALERT");
            }
        }
    }

    private void executeSchedule(ScheduledPayment schedule, LocalDate today) {
        User receiver = userRepository.findById(schedule.getReceiverId())
                .orElseThrow(() -> new RuntimeException("Receiver not found"));

        String note = schedule.getDescription();
        if (note == null || note.isBlank()) {
            note = "Auto-pay: " + schedule.getTitle();
        }

        Transaction tx = transactionService.sendMoney(
                schedule.getSenderId(),
                schedule.getReceiverId(),
                schedule.getAmount(),
                note
        );
        tx.setCategory("RECURRING");
        transactionRepository.save(tx);

        schedule.setExecutions(schedule.getExecutions() + 1);
        schedule.setLastRunAt(LocalDateTime.now());
        schedule.setLastFailureReason(null);
        schedule.setNextRunDate(calculateNextRun(schedule, today));
        schedule.setUpdatedAt(LocalDateTime.now());
        scheduledPaymentRepository.save(schedule);

        notificationService.createNotification(schedule.getSenderId(),
                "Scheduled Payment Paid",
                schedule.getTitle() + " sent Rs " + String.format("%.2f", schedule.getAmount())
                        + " to " + receiver.getName() + ".",
                "SUCCESS");
    }

    private ScheduledPayment getOwnedSchedule(Long scheduleId, Long userId) {
        ScheduledPayment schedule = scheduledPaymentRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("Scheduled payment not found"));
        if (!schedule.getSenderId().equals(userId)) {
            throw new RuntimeException("You can only manage your own scheduled payments");
        }
        return schedule;
    }

    private String normalizeFrequency(String frequency) {
        String normalized = frequency == null ? "" : frequency.toUpperCase();
        if (!List.of("MONTHLY", "WEEKLY").contains(normalized)) {
            throw new RuntimeException("Frequency must be MONTHLY or WEEKLY");
        }
        return normalized;
    }

    private LocalDate calculateFirstRun(String frequency, Integer dayOfMonth, Integer dayOfWeek, LocalDate startDate) {
        LocalDate start = startDate == null ? LocalDate.now() : startDate;
        if ("MONTHLY".equals(frequency)) {
            validateDayOfMonth(dayOfMonth);
            LocalDate candidate = withSafeDay(start, dayOfMonth);
            return candidate.isBefore(start) ? withSafeDay(start.plusMonths(1), dayOfMonth) : candidate;
        }

        validateDayOfWeek(dayOfWeek);
        LocalDate candidate = start.with(TemporalAdjusters.nextOrSame(java.time.DayOfWeek.of(dayOfWeek)));
        return candidate;
    }

    private LocalDate calculateNextRun(ScheduledPayment schedule, LocalDate fromDate) {
        if ("MONTHLY".equals(schedule.getFrequency())) {
            return withSafeDay(fromDate.plusMonths(1), schedule.getDayOfMonth());
        }
        return fromDate.plusWeeks(1);
    }

    private LocalDate withSafeDay(LocalDate date, Integer requestedDay) {
        int day = Math.min(requestedDay, date.lengthOfMonth());
        return date.withDayOfMonth(day);
    }

    private void validateDayOfMonth(Integer dayOfMonth) {
        if (dayOfMonth == null || dayOfMonth < 1 || dayOfMonth > 31) {
            throw new RuntimeException("Day of month must be between 1 and 31");
        }
    }

    private void validateDayOfWeek(Integer dayOfWeek) {
        if (dayOfWeek == null || dayOfWeek < 1 || dayOfWeek > 7) {
            throw new RuntimeException("Day of week must be between 1 and 7");
        }
    }
}
