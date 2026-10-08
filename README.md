# Private Chat

Privacy-first 1-to-1 messaging where phone numbers are private routing information, not chat identity.

## Current milestone: Phase 4 — private realtime chat

This version removes traditional account creation entirely.

Users do **not** create an account, choose a password, enter an email address, or sign in with a phone number. Instead:

1. User opens **Start privately**.
2. The server creates an anonymous internal user ID.
3. The server creates a secure server-side session and stores only a keyed hash of its secret.
4. User chooses a username.
5. The session is rotated and the user enters the protected dashboard.

The browser authenticates with a Secure/HttpOnly/SameSite cookie. No authentication secret is placed in `localStorage` or `sessionStorage`.

### Phone number boundary

There is no `PhoneIdentity` account table and no OTP/verification-code table. A phone number exists only as invitation delivery data: encrypted at rest plus a keyed lookup hash where required. After an invitation is accepted, cancelled, or expires, the encrypted phone value is cleared. It never becomes the visible chat identity.

## Included

- Next.js App Router + TypeScript
- Tailwind CSS v4 + shadcn/ui-compatible component structure
- Light/dark/system theme
- Mobile-first landing page
- Accountless start flow
- Anonymous user bootstrap API
- Username claim/update API with normalized uniqueness
- Server-side sessions with HttpOnly cookies
- Session rotation on username claim
- Logout and session revocation
- Protected dashboard routing
- Privacy Center updated for the accountless model
- PostgreSQL + Prisma 7 schema
- Prisma 7 PostgreSQL driver adapter setup
- UUID-based external resource IDs
- Invitation service foundation with encrypted phone delivery data
- SMS provider abstraction with console provider for local development and Twilio-ready provider
- Realtime service boundary using Socket.IO with origin checking
- Baseline security headers and same-origin checks
- Security primitive tests

## Phase 3 boundary

The invitation lifecycle is implemented and is now the entry point into the Phase 4 chat system:

- SMS invitation API + provider abstraction
- secure single-use invitation tokens
- invitation expiry, cancel, resend, and safe status UI
- atomic invitation acceptance + conversation creation
- server-side encrypted optional first message

Still later:

- block/report execution APIs
- production-grade distributed rate limiting
- anonymous identity recovery after browser-session loss

## Requirements

- Node.js 22+
- Docker Desktop (for PostgreSQL locally)
- npm 10+

## Local setup

```bash
cp .env.example .env
npm install
docker compose up -d
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000 and choose **Start privately**.

For realtime development in Phase 4+:

```bash
npm run dev:all
```

## Environment secrets

Generate random values rather than copying production credentials. Example:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Use a 32-byte base64 value for both `PHONE_ENCRYPTION_KEY` and `MESSAGE_ENCRYPTION_KEY`. Other secrets should also have at least 32 bytes of entropy.

## Prisma 7

Prisma ORM 7 requires a database driver adapter for direct connections. This project uses `@prisma/adapter-pg` with `pg`, and the generated client is imported from the configured `generated/prisma` output directory.

## Production notes

- Replace the process-local limiter with Redis or another shared store before horizontal scaling.
- Run the realtime service separately from the Next.js web service and enforce server-side session + conversation membership checks before accepting socket joins or message events.
- Configure Twilio (or another approved provider) for production SMS.
- Put all production traffic behind HTTPS and a managed secrets system.
- Review the CSP for any additional analytics or observability domains before enabling them.
- Do not advertise end-to-end encryption until an independently reviewed E2EE protocol has been implemented.
- Decide on an explicit anonymous-session recovery mechanism before treating the product as production-critical; the current MVP intentionally treats the browser session as the credential.


## Phase 3

The invitation lifecycle is now fully implemented. See `docs/PHASE-3.md`.

The accountless product uses anonymous UUID identities and secure HttpOnly sessions; phone numbers are private delivery routing data only.


## Phase 4

Realtime 1-to-1 chat is implemented with server-authorized Socket.IO connections, cursor-paginated encrypted message history, delivery/read receipts, typing indicators, presence, idempotent message retries, block-aware sends, and a REST fallback. See `docs/PHASE-4.md`.

Apply the Phase 4 migration with `npx prisma migrate dev` locally or `npx prisma migrate deploy` in production.
