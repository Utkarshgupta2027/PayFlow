package payment_system_backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtUtil {

    @Value("${jwt.secret:mysecretkeymysecretkeymysecretkey123}")
    private String secret;

    @Value("${jwt.refresh-secret:refreshsecretrefreshsecretrefresh1}")
    private String refreshSecret;

    // 10 days for access token
    private static final long ACCESS_EXPIRY = 864_000_000L;
    // 30 days for refresh token
    private static final long REFRESH_EXPIRY = 2_592_000_000L;

    private SecretKey getAccessKey() {
        return Keys.hmacShaKeyFor(secret.getBytes());
    }

    private SecretKey getRefreshKey() {
        return Keys.hmacShaKeyFor(refreshSecret.getBytes());
    }

    // ─── Access Token ─────────────────────────────────────────────────────────

    public String generateToken(String email) {
        return Jwts.builder()
                .subject(email)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + ACCESS_EXPIRY))
                .signWith(getAccessKey())
                .compact();
    }

    public String validateToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(getAccessKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return claims.getSubject();
        } catch (Exception e) {
            return null;
        }
    }

    // ─── Refresh Token ────────────────────────────────────────────────────────

    public String generateRefreshToken(String email) {
        return Jwts.builder()
                .subject(email)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + REFRESH_EXPIRY))
                .signWith(getRefreshKey())
                .compact();
    }

    public String validateRefreshToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(getRefreshKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return claims.getSubject();
        } catch (Exception e) {
            return null;
        }
    }
}
