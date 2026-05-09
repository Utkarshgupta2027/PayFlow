package payment_system_backend.dto;

public class LoginRequest {
    private String email;
    private String phoneNumber;
    private String password;

    public String getEmail()       { return email; }
    public String getPhoneNumber() { return phoneNumber; }
    public String getPassword()    { return password; }

    public void setEmail(String email)             { this.email = email; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public void setPassword(String password)       { this.password = password; }
}
