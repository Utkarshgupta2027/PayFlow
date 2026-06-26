# Secure Deployment

Production credentials must be configured as environment variables in your
hosting provider. Do not commit real secrets to this repository.

Use `.env.example` as the variable checklist.

Required backend variables:

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `MAIL_USER`
- `MAIL_PASS`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Optional backend variables:

- `MAIL_HOST`
- `MAIL_PORT`
- `BREVO_API_KEY` (recommended on Render if SMTP connections time out; use a Brevo API key, not the SMTP password)
- `BREVO_SENDER_EMAIL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

Frontend variable:

- `VITE_API_URL`

Before deploying, rotate every credential that was previously committed,
including database credentials, Gmail app password, Razorpay keys, and JWT
secrets.
