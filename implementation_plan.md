# PayFlow — Advanced Features Implementation Plan

## Background

PayFlow is a Spring Boot (Java 17) + React (Vite) payment application with MySQL. It already has JWT auth, QR payments, referrals, rewards, OTP via Twilio, and a basic analytics page. The goal is to add a production-grade feature set across backend and frontend.

---

## Scope — What We Will Build

This plan prioritizes **real, working features** over stubs. Some items from the original list are grouped or scoped to what is implementable without paid third-party services.

| # | Feature | Scope |
|---|---------|-------|
| 1 | **Fraud Detection** | Rule-based engine, risk score on Transaction, account freeze |
| 2 | **WebSocket Real-Time** | Spring WebSocket (STOMP), live balance + notifications |
| 3 | **Transaction Reversal / Refund** | Full request → admin approval flow |
| 4 | **Admin Panel** | Role-based (ADMIN/USER), view users, block, approve refunds |
| 5 | **JWT Refresh Tokens** | Dual-token system + rate limiting (Bucket4j) |
| 6 | **Smart Analytics** | Spending categories, monthly insights, balance predictions |
| 7 | **Notification System** | In-app (WebSocket push) + Email (JavaMailSender SMTP) |
| 8 | **Split Payment** | Create a split, invite friends by userId, track contributions |
| 9 | **CI/CD + Tests** | JUnit unit tests, GitHub Actions workflow |

> [!NOTE]
> **SMS** (Twilio) is already set up; notifications will also emit an SMS event hook.
> **Voice Payment** and **RabbitMQ/Kafka** are excluded – they require significant infrastructure not available locally.

---

## User Review Required

> [!IMPORTANT]
> **Email SMTP**: In-app email notifications require SMTP credentials. I will add `spring.mail.*` properties with placeholder env vars (`MAIL_HOST`, `MAIL_USER`, `MAIL_PASS`). Fill those in your `.env` or Railway config.

> [!WARNING]
> **Database schema changes**: Adding new columns (`role`, `frozen`, `risk_score`, `category`, `refund_status`…) uses `ddl-auto=update` so they auto-migrate. Existing data is safe.

> [!IMPORTANT]
> **Spring Boot 4 + WebSocket**: We are on Spring Boot **4.0.3** (latest). The WebSocket starter artifact is `spring-boot-starter-websocket` — compatible with Boot 4.

---

## Proposed Changes

### 1 — Backend: pom.xml

#### [MODIFY] pom.xml
- Add `spring-boot-starter-websocket`
- Add `spring-boot-starter-mail`
- Add `spring-boot-starter-security` (for role-based access)
- Add `bucket4j-core` (rate limiting)
- Add `spring-boot-starter-test` already present; add `mockito-core`

---

### 2 — Backend: Models

#### [MODIFY] Transaction.java
New fields:
- `double riskScore` — calculated by fraud engine
- `String category` — auto-categorized (e.g. TRANSFER, REFUND)
- `String description` — optional note from sender
- `String refundStatus` — null / PENDING / APPROVED / REJECTED
- `Long refundRequestedBy` — userId who requested

#### [MODIFY] User.java
New fields:
- `String role` — "USER" or "ADMIN" (default "USER")
- `boolean frozen` — account is blocked by admin or fraud detection
- `LocalDateTime lastLoginAt` — for device tracking

#### [NEW] Notification.java
Entity: id, userId, title, message, type (INFO/ALERT/SUCCESS), read (boolean), createdAt

#### [NEW] SplitPayment.java
Entity: id, title, totalAmount, creatorId, status (OPEN/CLOSED), List<SplitParticipant>

#### [NEW] SplitParticipant.java (Embeddable or separate entity)
Fields: userId, amountOwed, amountPaid, paid (boolean)

---

### 3 — Backend: Repositories

#### [NEW] NotificationRepository.java
- `findByUserIdOrderByCreatedAtDesc(Long userId)`

#### [NEW] SplitPaymentRepository.java
- `findByCreatorId(Long creatorId)`

#### [MODIFY] TransactionRepository.java
- `findBySenderIdAndTimeBetween(Long id, LocalDateTime from, LocalDateTime to)` — for fraud detection

#### [MODIFY] UserRepository.java  
- `findByRole(String role)` — for admin panel

---

### 4 — Backend: Services

#### [NEW] FraudDetectionService.java
Rule-based engine called before every transaction:
1. **Velocity check**: > 5 transactions in last 10 minutes → score += 40
2. **Large amount**: > ₹20,000 → score += 30
3. **New account + large transfer**: accountAgeDays < 3 && amount > 5,000 → score += 50
4. **Round numbers**: amount % 1000 == 0 && amount > 10,000 → score += 10
- If `riskScore >= 70` → **reject** transaction + freeze account
- If `riskScore >= 40` → **allow but flag** (mark `FLAGGED` in DB, notify admin)
- Returns `RiskAssessment { score, level(LOW/MEDIUM/HIGH), blocked }`

#### [NEW] NotificationService.java
- `createNotification(userId, title, message, type)` — saves to DB
- `sendEmail(to, subject, body)` — JavaMailSender
- `pushToWebSocket(userId, notification)` — SimpMessagingTemplate

#### [NEW] SplitPaymentService.java
- `createSplit(creatorId, title, totalAmount, List<Long> participantIds)`
- `payMyShare(splitId, userId, amount)`
- `getSplitsForUser(userId)`

#### [MODIFY] TransactionService.java
- Inject `FraudDetectionService` — run risk check before `sendMoney`
- Inject `NotificationService` — send notification on successful/failed transaction
- Add `requestRefund(transactionId, requesterId)`
- Add `approveRefund(transactionId, adminId)` — reverses money

#### [NEW] AdminService.java
- `getAllUsers()`
- `blockUser(userId)`
- `unblockUser(userId)`
- `getPendingRefunds()`
- `approveRefund(txId)` / `rejectRefund(txId)`
- `getDashboardStats()` — total users, total txn count, total volume, flagged count

---

### 5 — Backend: Controllers

#### [NEW] AdminController.java
`@RequestMapping("/admin")` — all endpoints require ROLE_ADMIN
- `GET /admin/users` — all users
- `POST /admin/users/{id}/block`
- `POST /admin/users/{id}/unblock`
- `GET /admin/refunds` — pending refund requests
- `POST /admin/refunds/{txId}/approve`
- `POST /admin/refunds/{txId}/reject`
- `GET /admin/stats` — dashboard stats

#### [NEW] NotificationController.java
- `GET /notifications/{userId}` — list notifications
- `POST /notifications/{id}/read` — mark read

#### [NEW] SplitPaymentController.java
- `POST /split/create`
- `POST /split/{id}/pay`
- `GET /split/user/{userId}`

#### [MODIFY] TransactionController.java
- `POST /transaction/refund/{txId}` — request refund

#### [MODIFY] UserController.java
- Login: record `lastLoginAt`, check `frozen` → return 403 if frozen

---

### 6 — Backend: WebSocket

#### [NEW] WebSocketConfig.java
- Configure STOMP endpoint `/ws`
- Message broker: `/topic` (broadcast), `/user` (per-user)

#### [NEW] WebSocketController.java (STOMP message handler)
- `@MessageMapping("/ping")` → sends `/user/{username}/topic/pong`

---

### 7 — Backend: Security & Rate Limiting

#### [NEW] RateLimitFilter.java
- Bucket4j in-memory: 5 requests/second per IP for `/user/login`

#### [MODIFY] JwtUtil.java
- Add `generateRefreshToken(email)` — 30-day expiry
- Add `validateToken(token)` — returns email or null

#### [NEW] SecurityConfig.java (Spring Security)
- Permit: `/user/register`, `/user/login`, `/ws/**`
- Require ADMIN: `/admin/**`
- All others: authenticated (JWT filter)

#### [NEW] JwtFilter.java
- `OncePerRequestFilter` — extracts Bearer token, validates, sets SecurityContext

---

### 8 — Backend: application.properties

Add:
```properties
# Mail
spring.mail.host=${MAIL_HOST:smtp.gmail.com}
spring.mail.port=587
spring.mail.username=${MAIL_USER:}
spring.mail.password=${MAIL_PASS:}
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true

# JWT Refresh
jwt.refresh-secret=${JWT_REFRESH_SECRET:refreshsecretrefreshsecretrefresh1}
jwt.refresh-expiration=2592000000

# Rate limit
rate.limit.login.capacity=5
rate.limit.login.refill-per-minute=5
```

---

### 9 — Backend: Tests

#### [NEW] FraudDetectionServiceTest.java
- Test all scoring rules individually
- Test block threshold

#### [NEW] TransactionServiceTest.java
- Test successful transfer
- Test insufficient balance
- Test fraud block

#### [NEW] AdminServiceTest.java
- Test user block/unblock
- Test refund approve/reject

---

### 10 — Frontend: New Pages

#### [NEW] AdminPanel.jsx (`/admin`)
- Tabs: Users | Transactions | Refunds | Analytics
- Users tab: table with name, email, balance, status, block/unblock button
- Refunds tab: pending refunds with approve/reject
- Stats tab: cards showing total users, volume, flagged transactions

#### [NEW] Notifications.jsx (`/notifications`)
- Bell icon in Layout header (with unread badge)
- List of notifications with type icons, mark-as-read

#### [NEW] SplitPayment.jsx (`/split`)
- Create split form: title, amount, select friends
- My splits: show progress (paid/total), pay my share button

---

### 11 — Frontend: Modified Pages

#### [MODIFY] Dashboard.jsx
- Live balance updates via WebSocket
- "Online" status indicator
- Quick notification bell

#### [MODIFY] SendMoney.jsx
- Show **risk score indicator** after entering amount (risk preview)
- Show if account is frozen

#### [MODIFY] Analytics.jsx
- Add spending categories pie chart
- Monthly comparison insight ("You spent X% more than last month")
- Balance runway prediction

#### [MODIFY] Layout.jsx
- Add Admin Panel link (if user role === ADMIN)
- Add Notifications bell with badge
- Add Split Payment link
- WebSocket connection on mount

---

### 12 — Frontend: Context & Utilities

#### [NEW] WebSocketContext.jsx
- Connects to `/ws` using SockJS + STOMP on login
- Provides `useWebSocket()` hook
- Dispatches notification events, balance updates

#### [MODIFY] AuthContext.jsx  
- Store role in context
- Add `isAdmin` computed value

#### [MODIFY] api.js
- Add `Authorization: Bearer <token>` header

---

### 13 — CI/CD

#### [NEW] .github/workflows/ci.yml
- On push to `main`: run `mvn test`, build frontend, report status

---

## Verification Plan

### Automated Tests
- `mvn test` inside `/demo` directory

### Manual Verification
1. Register a new user → login → confirm JWT in localStorage
2. Send money → check risk score in transaction history
3. Make 6 rapid transactions → confirm fraud block
4. Admin login (`role=ADMIN`) → `/admin` panel loads
5. Request refund → Admin approves → money returns
6. Open two browser tabs → send money in Tab 1 → balance updates in Tab 2 (WebSocket)
7. Create a split payment → other user pays their share

---

## Implementation Order

```
Phase 1 (Backend Core):
  pom.xml → Models → Repositories → FraudDetectionService
  → TransactionService (updated) → SecurityConfig + JwtFilter
  → AdminController → NotificationService + WebSocketConfig

Phase 2 (Frontend Core):
  api.js → WebSocketContext → Layout (notifications bell)
  → Dashboard (live balance) → SendMoney (risk indicator)
  → AdminPanel page → Notifications page

Phase 3 (Advanced):
  SplitPayment backend → SplitPayment frontend
  → Analytics enhancements → CI/CD workflow → Tests
```
