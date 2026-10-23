# Communications provider setup

This project uses server-side environment variables for messaging integrations. Never commit live API keys or paste them into chat.

## Supported provider configuration names

### SMS — Africa's Talking
- `AT_USERNAME`: provider account username (sandbox username for sandbox testing).
- `AT_API_KEY`: API key for the selected environment.
- `AT_SENDER_ID`: approved sender ID, when applicable.
- `AT_ENVIRONMENT`: use `sandbox` while testing; use `production` only after credentials and sender are approved.

### Email — Resend
- `RESEND_API_KEY`: server-side API key.
- `EMAIL_FROM`: verified sender, e.g. a mailbox at the college's verified domain.

### WhatsApp Business Cloud API
- `WHATSAPP_ACCESS_TOKEN`: server-side access token.
- `WHATSAPP_PHONE_NUMBER_ID`: registered sending phone number ID.
- `WHATSAPP_VERIFY_TOKEN`: secret chosen for webhook verification.
- `WHATSAPP_APP_SECRET`: Meta app secret used to verify webhook signatures.
- `WHATSAPP_WEBHOOK_URL`: public HTTPS webhook URL registered in Meta.

### Shared callback / application configuration
- `SMS_CALLBACK_SECRET`: high-entropy callback secret for the SMS delivery-report integration.
- `NEXT_PUBLIC_APP_URL`: canonical HTTPS URL of the deployed ERP.

## Configure in Vercel

1. Open the correct St. Monicah ERP project in Vercel.
2. Open Settings → Environment Variables.
3. Add only the values for provider accounts the college has purchased and activated.
4. Set values separately for Preview and Production where appropriate.
5. Redeploy after changing environment variables.
6. Open Communications → Provider integrations & API readiness and refresh the configuration check.

The readiness panel checks for the presence of environment variables only. It cannot prove that credentials are valid, that an account has credits, that a sender ID is approved, or that a message was delivered.

## Required production integration work and acceptance tests

Before enabling real external delivery, implement and verify server-side provider adapters, recipient resolution for each selected audience, queue/worker processing, retry and idempotency protection, provider-specific webhook signature verification, delivery status reconciliation, per-channel opt-out/preferences, rate limits, audit logs, and controlled test sends. Never send a bulk campaign until one test recipient has confirmed receipt and provider delivery callbacks have been checked.

In-app announcements remain independent of external provider credentials. SMS, email, and WhatsApp must never be marked delivered just because a provider request was accepted; final delivery states must come from a trusted provider status or webhook where supported.
