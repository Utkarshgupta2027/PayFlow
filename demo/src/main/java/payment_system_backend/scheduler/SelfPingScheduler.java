package payment_system_backend.scheduler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class SelfPingScheduler {

    private static final Logger log = LoggerFactory.getLogger(SelfPingScheduler.class);
    private final RestTemplate restTemplate;
    private final String healthUrl;

    public SelfPingScheduler(
            @Value("${SELF_PING_URL:http://127.0.0.1:${PORT:8080}}") String healthUrl) {
        this.restTemplate = new RestTemplate();
        this.healthUrl = healthUrl.endsWith("/healthz") ? healthUrl : healthUrl + "/healthz";
    }

    @Scheduled(fixedRateString = "${SELF_PING_RATE_MS:300000}", initialDelayString = "${SELF_PING_INITIAL_DELAY_MS:15000}")
    public void pingOwnHealthEndpoint() {
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(healthUrl, String.class);
            log.info("[SelfPing] ping {} -> {}", healthUrl, response.getStatusCode().value());
        } catch (Exception ex) {
            log.warn("[SelfPing] failed to ping {}: {}", healthUrl, ex.getMessage());
        }
    }
}
