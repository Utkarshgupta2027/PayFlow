package payment_system_backend.controller;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.model.User;
import payment_system_backend.repository.UserRepository;

import java.io.ByteArrayOutputStream;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/qr")
public class QrController {

    @Autowired
    private UserRepository userRepository;

    /**
     * Returns a 300x300 PNG QR code for the given user.
     * The encoded content is a JSON string: {"paymentId":1,"name":"Alice"}
     */
    @GetMapping(value = "/generate/{userId}", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> generateQr(@PathVariable Long userId) {
        Optional<User> optUser = userRepository.findById(userId);
        if (optUser.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = optUser.get();
        // Encode payment info as a compact JSON string
        String qrContent = String.format(
                "{\"paymentId\":%d,\"name\":\"%s\",\"email\":\"%s\"}",
                user.getId(),
                user.getName() != null ? user.getName().replace("\"", "") : "",
                user.getEmail() != null ? user.getEmail().replace("\"", "") : ""
        );

        try {
            Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
            hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
            hints.put(EncodeHintType.MARGIN, 1);

            MultiFormatWriter writer = new MultiFormatWriter();
            BitMatrix matrix = writer.encode(qrContent, BarcodeFormat.QR_CODE, 300, 300, hints);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", out);
            byte[] imageBytes = out.toByteArray();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.IMAGE_PNG);
            headers.setContentLength(imageBytes.length);
            headers.set("Cache-Control", "no-cache");

            return ResponseEntity.ok().headers(headers).body(imageBytes);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Returns QR content as a plain-text JSON (useful for testing / direct consumption)
     */
    @GetMapping("/info/{userId}")
    public ResponseEntity<String> getQrInfo(@PathVariable Long userId) {
        Optional<User> optUser = userRepository.findById(userId);
        if (optUser.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        User user = optUser.get();
        String info = String.format(
                "{\"paymentId\":%d,\"name\":\"%s\",\"email\":\"%s\"}",
                user.getId(),
                user.getName() != null ? user.getName().replace("\"", "") : "",
                user.getEmail() != null ? user.getEmail().replace("\"", "") : ""
        );
        return ResponseEntity.ok(info);
    }
}
