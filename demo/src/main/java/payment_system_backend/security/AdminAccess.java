package payment_system_backend.security;

public final class AdminAccess {
    public static final String ADMIN_EMAIL = "gutkarsh702@gmail.com";

    private AdminAccess() {
    }

    public static boolean isAdminEmail(String email) {
        return email != null && ADMIN_EMAIL.equalsIgnoreCase(email.trim());
    }

    public static String roleForEmail(String email) {
        return isAdminEmail(email) ? "ADMIN" : "USER";
    }
}
