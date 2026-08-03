# Production Deployment

DocuMind uses one private repository containing `frontend/` and `backend/`.
The production web domain is:

```text
https://documind.icu
```

The hosting provider has not been selected yet. Configure the provider to build
each directory independently and keep all secrets in its environment-variable
store, never in Git.

## Frontend

Build from `frontend/`:

```text
Install: npm ci
Cloudflare build: npm run cf:build
Cloudflare deploy: npm run cf:deploy
```

For Cloudflare Workers Builds, set the root directory to `/frontend`, the build
command to `npm run cf:build`, and the deploy command to `npm run cf:deploy`.
For preview branches, use `npm run cf:upload`.

Configure:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.documind.icu/api
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Only browser-safe Firebase configuration belongs in `NEXT_PUBLIC_*` variables.
Never expose `DATABASE_URL`, Firebase Admin credentials, storage secrets, or AI
provider keys in the frontend.

## Backend

Build from `backend/` using its `Dockerfile`, or run:

```text
Install: npm ci
Build: npm run build
Pre-deploy: npm run prisma:migrate:deploy
Start: npm run start:prod
Health check: /api/health
```

Set `CORS_ORIGIN=https://documind.icu` and configure the remaining variables
from `backend/.env.example` in the host's secret store. Point
`DATABASE_URL` only at the new Supabase project.

For a persistent IPv6-capable server, Supabase's direct connection is suitable.
For an IPv4-only persistent server, use the Supavisor session pooler. For
serverless or auto-scaling hosting, use its transaction pooler.

## New Supabase Database

1. Create a new Supabase project.
2. Copy its appropriate Postgres connection string into the production
   `DATABASE_URL` secret.
3. From `backend/`, run `npm run prisma:migrate:deploy`.
4. Run `npm run prisma:generate`.
5. Verify `/api/health` before directing production DNS traffic.

The existing `backend/prisma/migrations/` directory is intentionally preserved.

## Domain and Authentication

Point `documind.icu` to the frontend and `api.documind.icu` to the backend.
Add `documind.icu` to Firebase Authentication's authorized domains. The backend
generates Firebase action codes, and branded emails point to `/verify-email`
and `/reset-password` on the frontend.

## Transactional authentication email

Cloudflare DNS does not provide an SMTP server or create sender addresses.
Choose a transactional email provider that supports a custom sending domain,
verify `documind.icu` there, and copy its SMTP credentials to the backend:

```env
SMTP_ENABLED=true
SMTP_HOST=<provider SMTP host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<provider SMTP user>
SMTP_PASSWORD=<provider SMTP password>
AUTH_EMAIL_FRONTEND_URL=https://documind.icu
REGISTRATION_EMAIL_FROM=registration@documind.icu
RESET_PASSWORD_EMAIL_FROM=reset-password@documind.icu
```

Port 587 normally uses `SMTP_SECURE=false` with STARTTLS. Port 465 normally
uses `SMTP_SECURE=true`. Follow the provider's exact values.

Add the provider's DKIM records in Cloudflare and merge its SPF requirement
with the existing Firebase SPF record; a domain must not have two separate SPF
TXT records. Add a DMARC TXT record after SPF and DKIM pass. Keep all mail
records set to **DNS only**.

These sender identities do not need inboxes unless replies must be received.
The templates tell recipients not to reply.

## Verification

After deployment:

1. Confirm `https://documind.icu` loads over HTTPS.
2. Confirm frontend requests resolve through `https://api.documind.icu/api`.
3. Confirm the backend health endpoint succeeds.
4. Run the Prisma migration status command against the new database.
5. Register a test account and confirm the verification email arrives from
   `registration@documind.icu`.
6. Request a password reset and confirm it arrives from
   `reset-password@documind.icu` and opens the DocuMind reset form.
7. Test sign-in, document upload, and AI chat.
