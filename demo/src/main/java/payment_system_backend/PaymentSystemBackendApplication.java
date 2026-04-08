package payment_system_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "payment_system_backend")
public class PaymentSystemBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(PaymentSystemBackendApplication.class, args);
	}

}
