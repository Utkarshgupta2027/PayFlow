# PayFlow

PayFlow is a full-stack digital wallet and payment system. It includes a React frontend, a Spring Boot backend, JWT-based security, real-time notifications through WebSocket/STOMP, and database persistence through JPA using local H2 or production MySQL.

## Project Structure

```text
PayFlow/
|-- frontend/          # React + Vite client application
|-- demo/              # Spring Boot backend API
|-- .env.example       # Environment variable reference
|-- Dockerfile         # Root deployment Dockerfile
|-- DEPLOYMENT.md      # Deployment notes
`-- README.md
```

## Tech Stack

Frontend:
- React 19
- Vite
- React Router
- Recharts
- STOMP + SockJS for live updates
- jsPDF and html2canvas for receipts/statements
- Tailwind CSS/PostCSS tooling

Backend:
- Java 17
- Spring Boot
- Spring Web MVC
- Spring Security
- Spring Data JPA
- Spring WebSocket
- Spring Mail
- JWT authentication
- Bucket4j rate limiting
- Razorpay integration
- Twilio integration
- ZXing QR generation
- Springdoc OpenAPI/Swagger UI

Database:
- H2 file database for local development
- MySQL for production/deployment
- Hibernate `ddl-auto=update` for schema updates

## Frontend Functions

Authentication:
- User registration
- Login with JWT storage
- Refresh-token based session renewal
- Forgot password flow
- Protected routes for logged-in users
- Admin-only route protection

Dashboard:
- Shows wallet balance and user summary
- Loads recent transactions
- Displays linked bank accounts
- Supports adding money to wallet
- Supports Razorpay payment order creation and verification
- Supports wallet withdrawal
- Claims daily reward bonus

Send Money:
- Transfer money from one user to another
- Recipient lookup by user ID
- Transaction PIN check
- Favorite contacts support
- Fraud/risk preview before sending
- User balance refresh after successful payment

Request Money:
- Create money requests
- View incoming and outgoing requests
- Accept, decline, or cancel requests
- Transaction PIN verification for accepted requests

Transactions:
- View transaction history
- Search/filter transaction records
- Export or generate transaction-related documents through utility functions
- Request refunds where supported by backend status

Analytics:
- View spending and transaction analytics
- Select analytics period
- Uses backend transaction analytics and history data
- Displays charts through Recharts

Bill Payments:
- Pay bills through the wallet
- Stores bill payment as categorized transaction data
- Supports bill payment request payloads through the backend API

Rewards:
- View reward points
- Claim daily bonus
- Track reward sources such as transactions and daily bonuses

Referral:
- View personal referral code
- Claim referral rewards using another user's code

QR:
- Generate user payment QR code
- Fetch QR image from backend
- Scan or use QR information for payment flows

Offline Payments:
- Offline Wallet dashboard showing active escrow limits, remaining balance, spent, and expiry
- Enable offline payments online with transaction PIN
- Top up escrow, release unspent escrow, or revoke wallet
- Pay Offline without internet: signs payment tokens via WebCrypto ECDSA P-256 and displays QR code + copyable payload
- Receive Offline without internet: scans QR or pastes code, verifies server certificate & token signature locally, and stores as `PENDING_SETTLEMENT` in IndexedDB
- Auto-sync on reconnect or manual sync trigger
- Global offline status banner and pending settlement indicator

Split Payments:
- Create split payment groups
- Add participants
- View split payments for current user
- Pay participant share
- Track paid/unpaid participants

Scheduled Payments:
- Create recurring or scheduled payments
- View scheduled payments
- Pause/resume/update status
- Delete scheduled payments
- Uses transaction PIN for protected payment actions

Notifications:
- View user notifications
- See unread notification count
- Mark individual notifications as read
- Mark all notifications as read
- Receives real-time notifications through WebSocket/STOMP

Settings:
- Update profile information
- Upload or change profile picture URL
- Set transaction PIN
- Check PIN status
- Manage linked bank accounts
- Add, remove, and mark primary bank account
- Manage favorite contacts

Check Balance:
- Verify transaction PIN
- Display current wallet balance

Feedback:
- Submit feedback with name, email, subject, message, and rating

Admin Panel:
- View platform statistics
- View all users
- Block or unblock users
- View refund requests
- Approve or reject refunds

Layout and Shared UI:
- Protected application shell
- User avatar component
- PIN modal
- Toast messages
- Theme context
- Language context
- Auth context
- WebSocket context

## Backend Functions

Authentication and Users (`/user`):
- `POST /user/register` registers a new user
- `POST /user/login` authenticates a user and returns tokens
- `POST /user/refresh` refreshes an access token
- `GET /user/{id}` returns user details
- `DELETE /user/{id}` deletes a user
- `PUT /user/profile-picture` updates profile picture
- `GET /user/pin-status` checks whether transaction PIN is set
- `POST /user/set-pin` creates/updates transaction PIN
- `POST /user/check-balance` verifies PIN and returns balance
- `POST /user/forgot-password/send-otp` sends reset OTP
- `POST /user/forgot-password/reset` resets password
- `POST /user/make-admin` promotes a user to admin

OTP and Email OTP:
- `POST /otp/send` sends OTP
- `POST /otp/register` verifies OTP registration flow
- `POST /otp/login` verifies OTP login flow
- `POST /api/email-otp/send` sends email OTP
- `POST /api/email-otp/verify` verifies email OTP

Wallet and Payments (`/wallet`):
- `GET /wallet/run` health/test endpoint
- `POST /wallet/addMoney` adds money directly to wallet
- `POST /wallet/payment/order` creates Razorpay payment order
- `POST /wallet/payment/verify` verifies Razorpay payment
- `POST /wallet/withdraw` withdraws wallet balance to bank account
- `POST /wallet/payment/webhook` receives Razorpay webhook events

Transactions (`/transaction`):
- `POST /transaction/send` transfers money
- `GET /transaction/risk-preview` previews fraud risk
- `GET /transaction/history/{userId}` returns user transaction history
- `GET /transaction/search/{userId}` searches user transactions
- `POST /transaction/refund/{txId}` requests refund
- `POST /transaction/retry/{id}` retries failed transaction
- `GET /transaction/analytics/{userId}` returns analytics data

Bank Accounts (`/bank`):
- `GET /bank/accounts/{userId}` lists linked accounts
- `POST /bank/add` adds a bank account
- `DELETE /bank/remove/{accountId}` removes an account
- `PUT /bank/primary/{userId}/{accountId}` marks account as primary

Favorite Contacts (`/contacts`):
- `GET /contacts` lists contacts for the current user
- `POST /contacts` adds a favorite contact
- `DELETE /contacts/{id}` removes a favorite contact

Money Requests (`/request-money`):
- `POST /request-money/create` creates a request
- `POST /request-money/{id}/accept` accepts and pays request
- `POST /request-money/{id}/decline` declines request
- `POST /request-money/{id}/cancel` cancels request
- `GET /request-money/incoming` lists incoming requests
- `GET /request-money/outgoing` lists outgoing requests

Split Payments (`/split`):
- `POST /split/create` creates split payment
- `POST /split/{splitId}/pay` pays user share
- `GET /split/user/{userId}` lists user's split payments
- `GET /split/{splitId}` returns split payment details

Scheduled Payments (`/scheduled-payments`):
- `GET /scheduled-payments` lists scheduled payments
- `POST /scheduled-payments` creates scheduled payment
- `PATCH /scheduled-payments/{id}/status` updates status
- `DELETE /scheduled-payments/{id}` deletes scheduled payment

Bill Payments (`/bill-payments`):
- `POST /bill-payments/pay` pays a bill and records the transaction

Rewards (`/rewards`):
- `GET /rewards/{userId}` returns rewards for a user
- `POST /rewards/daily-bonus/{userId}` claims daily bonus

Referral (`/referral`):
- `GET /referral/code/{userId}` returns referral code
- `POST /referral/claim` claims referral reward

QR (`/qr`):
- `GET /qr/generate/{userId}` generates a PNG payment QR
- `GET /qr/info/{userId}` returns QR payment information

Notifications (`/notifications`):
- `GET /notifications/{userId}` lists user notifications
- `GET /notifications/{userId}/unread-count` returns unread count
- `POST /notifications/{id}/read` marks one notification as read
- `POST /notifications/read-all/{userId}` marks all as read

Feedback (`/api/feedback`):
- `POST /api/feedback` saves user feedback

Offline Payments (`/offline`):
- `POST /offline/enable` enables offline mode, validates PIN, deducts balance to escrow, issues server-signed certificate
- `POST /offline/topup` tops up offline escrow balance from main wallet
- `POST /offline/release` releases unused escrow funds back to main wallet balance
- `POST /offline/revoke` revokes offline wallet (lost device flow or admin action) and refunds remaining escrow
- `GET /offline/status` returns current offline wallet status, limits, and active certificate
- `GET /offline/public-key` returns server's ECDSA public key for certificate verification
- `POST /offline/sync` rate-limited idempotent batch settlement endpoint verifying signatures, strictly increasing counters, and escrow limits in isolated transactions

Admin (`/admin`):
- `GET /admin/stats` returns admin dashboard stats
- `GET /admin/users` lists all users
- `POST /admin/users/{id}/block` blocks a user
- `POST /admin/users/{id}/unblock` unblocks a user
- `GET /admin/refunds` lists refund requests
- `POST /admin/refunds/{txId}/approve` approves refund
- `POST /admin/refunds/{txId}/reject` rejects refund

System:
- `GET /` basic service response
- `GET /healthz` health check
- `/ws` SockJS/STOMP endpoint for real-time updates
- `/v3/api-docs` OpenAPI JSON
- `/swagger-ui.html` Swagger UI

## Database Functions

The backend uses Spring Data JPA repositories and Hibernate entities. Local development uses a file-backed H2 database at `demo/data/paymentdb`; production can use MySQL by enabling the `mysql` profile.

Main persisted data:
- `app_user`: user account, profile, role, balance, referral data, frozen status, transaction PIN, OTP, and login metadata
- `transaction`: sender, receiver, amount, status, time, risk score, risk level, category, description, refund state, gateway IDs, failure reason, and currency
- `bank_account`: linked user bank accounts, masked account number, IFSC, bank name, account type, and primary flag
- `notification`: notification title, message, type, read status, user ID, and created time
- `money_request`: requester, target user, amount, description, status, and created time
- `favorite_contact`: saved contacts per owner user
- `reward`: reward points, source, user ID, and date
- `scheduled_payment`: recurring payment details, frequency, next run date, status, execution count, and failure reason
- `split_payment`: split group title, total amount, creator, status, created time, and participants
- `split_participant`: split payment participant, amount owed, amount paid, paid status, and profile information
- `otp_records`: OTP identifier, OTP value, and created time
- `feedback`: feedback name, email, subject, message, rating, and submission time

Repository layer:
- UserRepository
- TransactionRepository
- BankAccountRepository
- NotificationRepository
- MoneyRequestRepository
- FavoriteContactRepository
- RewardRepository
- ScheduledPaymentRepository
- SplitPaymentRepository
- OtpRepository
- FeedbackRepository

## Security

- JWT access tokens secure protected APIs.
- Refresh tokens are used by the frontend to renew expired sessions.
- Passwords are encoded with BCrypt.
- Admin APIs require `ADMIN`/`ROLE_ADMIN` authority.
- Public APIs include registration, login, refresh, OTP, forgot password, feedback, QR, health, Swagger, WebSocket, and Razorpay webhook.
- Most wallet, transaction, bank, request, split, notification, reward, settings, and admin operations require authentication.
- Transaction PIN is used for sensitive wallet actions.

## Real-Time Features

The backend exposes a SockJS/STOMP endpoint at:

```text
/ws
```

The frontend subscribes to:

```text
/user/{userEmail}/topic/notifications
/user/{userEmail}/topic/balance
```

This supports live notifications and wallet balance updates.

## Local Setup

### Backend

Requirements:
- Java 17
- Maven wrapper included in `demo/`

Run the backend:

```bash
cd demo
./mvnw spring-boot:run
```

On Windows PowerShell:

```powershell
cd demo
.\mvnw.cmd spring-boot:run
```

Default backend URL:

```text
http://localhost:8080
```

Swagger UI:

```text
http://localhost:8080/swagger-ui.html
```

H2 console:

```text
http://localhost:8080/h2-console
```

Local H2 settings:

```text
JDBC URL: jdbc:h2:file:./data/paymentdb
Username: sa
Password:
```

### Frontend

Requirements:
- Node.js
- npm

Install and run:

```bash
cd frontend
npm install
npm run dev
```

Default frontend URL:

```text
http://localhost:5173
```

The frontend uses this API base by default:

```text
http://localhost:8080
```

To change it, set:

```text
VITE_API_URL=https://your-backend-url
```

## Environment Variables

See `.env.example` for the full list.

Backend:
- `SPRING_PROFILES_ACTIVE`
- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_USER`
- `MAIL_PASS`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Frontend:
- `VITE_API_URL`

## Profiles

Local profile:
- Enabled by default through `SPRING_PROFILES_ACTIVE:local`
- Uses H2 database
- Stores data in `demo/data/paymentdb`
- Enables H2 console

MySQL profile:
- Enable with `SPRING_PROFILES_ACTIVE=mysql`
- Uses `application-mysql.properties`
- Reads datasource settings from environment variables
- Intended for production/deployment

## Build and Test

Backend tests:

```bash
cd demo
./mvnw test
```

Backend package:

```bash
cd demo
./mvnw clean package
```

Frontend build:

```bash
cd frontend
npm run build
```

Frontend preview:

```bash
cd frontend
npm run preview
```

## Deployment Notes

- Backend can run with Docker or Railway configuration.
- Frontend includes Vercel configuration.
- For production, set strong `JWT_SECRET` and `JWT_REFRESH_SECRET`.
- Configure MySQL credentials through environment variables.
- Configure Razorpay keys before enabling real payment order verification.
- Configure SMTP credentials for email OTP and password reset.
- Configure Twilio credentials only if SMS OTP is needed.
