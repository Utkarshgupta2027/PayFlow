package payment_system_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = "payment_system_backend")
@EnableScheduling
public class PaymentSystemBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(PaymentSystemBackendApplication.class, args);
	}

}
