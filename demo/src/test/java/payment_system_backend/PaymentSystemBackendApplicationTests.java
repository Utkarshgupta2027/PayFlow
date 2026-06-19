package payment_system_backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import payment_system_backend.model.User;
import payment_system_backend.repository.UserRepository;
import payment_system_backend.security.AdminAccess;
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
		User admin = upsertTestUser(
				AdminAccess.ADMIN_EMAIL,
				"Integration Admin",
				"9991112222",
				"USER");
		User fakeAdmin = upsertTestUser(
				"admin_test_integration@example.com",
				"Fake Integration Admin",
				"9991112223",
				"ADMIN");

		try {
			HttpClient client = HttpClient.newHttpClient();
			HttpRequest allowedRequest = HttpRequest.newBuilder()
					.uri(URI.create("http://localhost:8080/admin/refunds"))
					.header("Authorization", "Bearer " + jwtUtil.generateToken(AdminAccess.ADMIN_EMAIL))
					.GET()
					.build();
			HttpRequest deniedRequest = HttpRequest.newBuilder()
					.uri(URI.create("http://localhost:8080/admin/refunds"))
					.header("Authorization", "Bearer " + jwtUtil.generateToken(fakeAdmin.getEmail()))
					.GET()
					.build();

			HttpResponse<String> allowedResponse = client.send(allowedRequest, HttpResponse.BodyHandlers.ofString());
			HttpResponse<String> deniedResponse = client.send(deniedRequest, HttpResponse.BodyHandlers.ofString());
			System.out.println("Allowed admin response status: " + allowedResponse.statusCode());
			System.out.println("Denied fake admin response status: " + deniedResponse.statusCode());
			
			assertEquals(200, allowedResponse.statusCode(), "Configured admin email should return 200 OK");
			assertEquals(403, deniedResponse.statusCode(), "Any other email must be denied even if its stored role is ADMIN");
			System.out.println("SUCCESS: Admin authorization is restricted to " + AdminAccess.ADMIN_EMAIL);
		} catch (AssertionError | Exception e) {
			System.out.println("FAILURE: Admin authorization failed!");
			e.printStackTrace();
			throw e;
		} finally {
			userRepository.delete(admin);
			userRepository.delete(fakeAdmin);
			System.out.println("Cleaned up test admin users.");
		}
		System.out.println("=== END ADMIN REFUNDS AUTHORIZATION TEST ===");
	}

	private User upsertTestUser(String email, String name, String phoneNumber, String role) {
		User user = userRepository.findByEmail(email);
		if (user == null) {
			user = new User();
			user.setEmail(email);
		}
		user.setName(name);
		user.setPassword("password123");
		user.setPhoneNumber(phoneNumber);
		user.setRole(role);
		return userRepository.save(user);
	}

}





