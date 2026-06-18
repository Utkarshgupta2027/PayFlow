package payment_system_backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import payment_system_backend.model.Transaction;
import payment_system_backend.model.User;

import java.time.format.DateTimeFormatter;

@Service
public class EmailService {

    private static final DateTimeFormatter INVOICE_DATE =
            DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");

    @Autowired
    private NotificationService notificationService;

    @Async
    public void sendOtpVerificationMail(String email, String otp) {
        String subject = "Your PayFlow OTP Verification Code";
        String body = "Hi,\n\n"
                + "Your PayFlow verification OTP is " + otp + ".\n\n"
                + "This code is valid for 5 minutes. Do not share it with anyone.\n\n"
                + "PayFlow Team";

        notificationService.sendEmail(email, subject, body);
    }

    @Async
    public void sendWelcomeMail(User user) {
        if (user == null) return;

        String subject = "Welcome to PayFlow";
        String body = "Hi " + safeName(user) + ",\n\n"
                + "Welcome to PayFlow. Your account has been created successfully.\n\n"
                + "You can now send money, request payments, scan QR codes, pay bills, and track your transactions from your dashboard.\n\n"
                + "Referral Code: " + valueOrDash(user.getReferralCode()) + "\n\n"
                + "PayFlow Team";

        notificationService.sendEmail(user.getEmail(), subject, body);
    }

    @Async
    public void sendTransactionInvoice(User sender, User receiver, Transaction tx) {
        if (tx == null) return;

        String invoice = buildTransactionInvoice(sender, receiver, tx);

        if (sender != null) {
            notificationService.sendEmail(
                    sender.getEmail(),
                    "PayFlow Transaction Invoice #" + valueOrDash(tx.getId()),
                    "Hi " + safeName(sender) + ",\n\n"
                            + "Your payment invoice is ready.\n\n"
                            + invoice
                            + "If this transaction was not made by you, contact PayFlow support immediately.\n\n"
                            + "PayFlow Team");
        }

        if (receiver != null) {
            notificationService.sendEmail(
                    receiver.getEmail(),
                    "PayFlow Payment Received #" + valueOrDash(tx.getId()),
                    "Hi " + safeName(receiver) + ",\n\n"
                            + "You received a payment on PayFlow.\n\n"
                            + invoice
                            + "PayFlow Team");
        }
    }

    private String buildTransactionInvoice(User sender, User receiver, Transaction tx) {
        return "TRANSACTION INVOICE\n"
                + "-------------------\n"
                + "Invoice / Transaction ID: #" + valueOrDash(tx.getId()) + "\n"
                + "Date: " + (tx.getTime() == null ? "-" : tx.getTime().format(INVOICE_DATE)) + "\n"
                + "Status: " + valueOrDash(tx.getStatus()) + "\n"
                + "Category: " + valueOrDash(tx.getCategory()) + "\n"
                + "Amount: " + formatInr(tx.getAmount()) + "\n"
                + "Sender: " + userLine(sender, tx.getSenderId()) + "\n"
                + "Receiver: " + userLine(receiver, tx.getReceiverId()) + "\n"
                + "Description: " + valueOrDash(tx.getDescription()) + "\n"
                + "Risk Level: " + valueOrDash(tx.getRiskLevel()) + "\n\n";
    }

    private String userLine(User user, Long fallbackId) {
        if (user == null) return "#" + valueOrDash(fallbackId);
        return safeName(user) + " (#" + valueOrDash(user.getId()) + ", " + valueOrDash(user.getEmail()) + ")";
    }

    private String safeName(User user) {
        return user.getName() == null || user.getName().isBlank() ? "there" : user.getName();
    }

    private String valueOrDash(Object value) {
        if (value == null) return "-";
        String text = String.valueOf(value);
        return text.isBlank() ? "-" : text;
    }

    private String formatInr(double amount) {
        return "INR " + String.format("%.2f", amount);
    }
}
