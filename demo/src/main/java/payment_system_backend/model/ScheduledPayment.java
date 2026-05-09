package payment_system_backend.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
public class ScheduledPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long senderId;
    private Long receiverId;
    private double amount;

    @Column(length = 80)
    private String title;

    @Column(length = 255)
    private String description;

    @Column(length = 20)
    private String frequency;

    private Integer dayOfMonth;
    private Integer dayOfWeek;
    private LocalDate nextRunDate;
    private LocalDateTime lastRunAt;

    @Column(length = 20)
    private String status = "ACTIVE";

    @Column(length = 255)
    private String lastFailureReason;

    private int executions = 0;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public Long getSenderId() { return senderId; }
    public Long getReceiverId() { return receiverId; }
    public double getAmount() { return amount; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getFrequency() { return frequency; }
    public Integer getDayOfMonth() { return dayOfMonth; }
    public Integer getDayOfWeek() { return dayOfWeek; }
    public LocalDate getNextRunDate() { return nextRunDate; }
    public LocalDateTime getLastRunAt() { return lastRunAt; }
    public String getStatus() { return status; }
    public String getLastFailureReason() { return lastFailureReason; }
    public int getExecutions() { return executions; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public void setId(Long id) { this.id = id; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }
    public void setReceiverId(Long receiverId) { this.receiverId = receiverId; }
    public void setAmount(double amount) { this.amount = amount; }
    public void setTitle(String title) { this.title = title; }
    public void setDescription(String description) { this.description = description; }
    public void setFrequency(String frequency) { this.frequency = frequency; }
    public void setDayOfMonth(Integer dayOfMonth) { this.dayOfMonth = dayOfMonth; }
    public void setDayOfWeek(Integer dayOfWeek) { this.dayOfWeek = dayOfWeek; }
    public void setNextRunDate(LocalDate nextRunDate) { this.nextRunDate = nextRunDate; }
    public void setLastRunAt(LocalDateTime lastRunAt) { this.lastRunAt = lastRunAt; }
    public void setStatus(String status) { this.status = status; }
    public void setLastFailureReason(String lastFailureReason) { this.lastFailureReason = lastFailureReason; }
    public void setExecutions(int executions) { this.executions = executions; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
