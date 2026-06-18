package payment_system_backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import payment_system_backend.model.User;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.security.JwtUtil;

import javax.sql.DataSource;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
class PaymentSystemBackendApplicationTests {

	@Autowired
	private DataSource dataSource;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private JwtUtil jwtUtil;

	@Test
	void contextLoads() throws Exception {
		System.out.println("=== STARTING DATABASE TABLES CHECK ===");
		try (Connection connection = dataSource.getConnection()) {
			DatabaseMetaData metaData = connection.getMetaData();
			try (ResultSet rs = metaData.getTables(null, null, "%", new String[] { "TABLE" })) {
				List<String> tables = new ArrayList<>();
				while (rs.next()) {
					tables.add(rs.getString("TABLE_NAME"));
				}
				System.out.println("Tables found in database: " + tables);
			}
		}
		System.out.println("=== END DATABASE TABLES CHECK ===");

		System.out.println("=== STARTING USER DETAILS CHECK ===");
		try {
			List<User> users = userRepository.findAll();
			System.out.println("Total users: " + users.size());
			for (User u : users) {
				System.out.println("User ID: " + u.getId() + ", Name: " + u.getName() + ", Email: " + u.getEmail() + ", Phone: " + u.getPhoneNumber() + ", Role: " + u.getRole());
			}
		} catch (Exception e) {
			System.out.println("Failed to query users: " + e.getMessage());
			e.printStackTrace();
		}
		System.out.println("=== END USER DETAILS CHECK ===");
	}

	@Test
	void testAdminRefundsAuthorization() throws Exception {
		System.out.println("=== STARTING ADMIN REFUNDS AUTHORIZATION TEST ===");
		// Ensure we have at least one ADMIN user in the database
		String adminEmail = "admin_test_integration@example.com";
		User admin = userRepository.findByEmail(adminEmail);
		if (admin == null) {
			admin = new User();
			admin.setName("Integration Admin");
			admin.setEmail(adminEmail);
			admin.setPassword("password123");
			admin.setPhoneNumber("9991112222");
			admin.setRole("ADMIN");
			admin = userRepository.save(admin);
			System.out.println("Created test admin user: " + admin.getEmail());
		} else {
			admin.setRole("ADMIN");
			admin = userRepository.save(admin);
			System.out.println("Updated existing test admin user to ADMIN role: " + admin.getEmail());
		}

		// Generate token
		String token = jwtUtil.generateToken(adminEmail);
		System.out.println("Generated JWT token: " + token);

		// Perform HTTP request using HttpClient to the running local port 8080
		try {
			HttpClient client = HttpClient.newHttpClient();
			HttpRequest httpRequest = HttpRequest.newBuilder()
					.uri(URI.create("http://localhost:8080/admin/refunds"))
					.header("Authorization", "Bearer " + token)
					.GET()
					.build();

			HttpResponse<String> response = client.send(httpRequest, HttpResponse.BodyHandlers.ofString());
			System.out.println("HTTP Response Status: " + response.statusCode());
			System.out.println("HTTP Response Body: " + response.body());
			
			assertEquals(200, response.statusCode(), "Admin request should return 200 OK");
			System.out.println("SUCCESS: Admin authorization verified. Endpoint /admin/refunds returned 200 OK.");
		} catch (AssertionError | Exception e) {
			System.out.println("FAILURE: Admin authorization failed!");
			e.printStackTrace();
			throw e;
		} finally {
			// Cleanup
			userRepository.delete(admin);
			System.out.println("Cleaned up test admin user.");
		}
		System.out.println("=== END ADMIN REFUNDS AUTHORIZATION TEST ===");
	}

}





