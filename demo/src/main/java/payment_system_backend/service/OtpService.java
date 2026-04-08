package payment_system_backend.service;

import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import payment_system_backend.model.OtpRecord;
import payment_system_backend.repository.OtpRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;

@Service
public class OtpService {

    private final OtpRepository otpRepository;

    @Value("${twilio.account-sid}")
    private String accountSid;

    @Value("${twilio.auth-token}")
    private String authToken;

    @Value("${twilio.phone-number}")
    private String fromPhone;

    public OtpService(OtpRepository otpRepository) {
        this.otpRepository = otpRepository;
    }

    /**
     * Generates a 6-digit OTP, saves it, and sends via Twilio SMS.
     * Returns the OTP (for dev convenience; omit in production).
     */
    public String sendOtp(String phoneNumber) {
        String otp = String.format("%06d", new Random().nextInt(1_000_000));

        OtpRecord record = new OtpRecord(phoneNumber, otp, LocalDateTime.now());
        otpRepository.save(record);

        try {
            Twilio.init(accountSid, authToken);
            Message.creator(
                    new PhoneNumber(phoneNumber),
                    new PhoneNumber(fromPhone),
                    "Your PayFlow OTP is: " + otp + ". Valid for 5 minutes. Do not share with anyone."
            ).create();
        } catch (Exception e) {
            // If Twilio credentials not configured, log otp for local dev
            System.out.println("[DEV] OTP for " + phoneNumber + " : " + otp);
        }

        return otp;
    }

    /**
     * Verifies that the given OTP matches the latest one sent to the phone number
     * and that it was created within the last 5 minutes.
     */
    public boolean verifyOtp(String phoneNumber, String otp) {
        List<OtpRecord> records = otpRepository.findByPhoneNumberOrderByCreatedAtDesc(phoneNumber);
        if (records.isEmpty()) return false;

        OtpRecord latest = records.get(0);
        boolean notExpired = latest.getCreatedAt().isAfter(LocalDateTime.now().minusMinutes(5));
        boolean matches    = latest.getOtp().equals(otp);
        return matches && notExpired;
    }
}
