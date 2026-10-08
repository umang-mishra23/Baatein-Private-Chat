# Phase 3 — Private Invitation System

Phase 3 replaces the invitation placeholder with a real, server-enforced invitation lifecycle.

## Implemented

- Cryptographically secure 32-byte invitation tokens.
- Only an HMAC of each token is persisted.
- Recipient phone numbers are normalized to E.164 on the server.
- Recipient phone numbers are AES-256-GCM encrypted at rest.
- A keyed phone lookup hash is stored for cooldown/abuse controls without exposing the raw number.
- Generic invitation SMS text; sender phone number is never included.
- Twilio provider adapter plus a console provider for local development.
- Invitation TTL (`INVITATION_TTL_HOURS`, default 24 hours).
- Invitation resend cooldown (`INVITATION_RESEND_COOLDOWN_SECONDS`, default 60 seconds).
- Maximum of three resends per invitation; each resend rotates the capability token and invalidates the previous one.
- Sender can cancel pending invitations.
- Sender dashboard can see safe status/expiry metadata without recipient phone data.
- Accept endpoint validates the capability token and username.
- Acceptance atomically consumes the invitation, creates the 1-to-1 conversation, adds both members, persists the optional first message as server-side encrypted ciphertext, and creates/rotates the recipient session in the same database transaction.
- Concurrent invitation acceptance is guarded by a conditional atomic update on the pending invitation row.
- Invite pages use `Cache-Control: no-store` and the global `no-referrer` policy to reduce capability-token leakage through caches/referrers.
- No raw invitation token, raw phone number, or message body is written to application security logs.

## SMS delivery model

The database row is created before calling the SMS provider so the system has an auditable pending delivery state. Network delivery is deliberately kept outside database transactions. Provider success is recorded as `SENT`; provider failure is recorded as `FAILED` and the invitation remains cancellable/resendable.

For a production system with strict delivery guarantees, the next hardening step is an outbox/queue worker so a process crash between database commit and provider submission cannot leave a delivery silently stuck.

## Accountless identity behavior

A recipient who has no active anonymous session receives a new internal UUID identity when accepting an invitation. A recipient who already has an active anonymous session uses that identity; if it already has a username, the invitation must be accepted using that username. The browser receives only an HttpOnly session cookie.

## Routes

- `POST /api/invitations` — create invitation + send SMS
- `GET /api/invitations` — safe sender-side invitation list
- `POST /api/invitations/:id/cancel` — cancel pending invitation
- `POST /api/invitations/:id/resend` — rotate token + resend SMS
- `POST /api/invitations/accept` — atomically accept invitation and create conversation
- `/invite/:token` — invitation capability page

## Not yet implemented

- WebSocket message delivery and authorization (Phase 4).
- Conversation/message history API and cursor pagination (Phase 4).
- Redis/shared rate limiting for horizontally scaled production (Phase 6).
- SMS delivery outbox/queue and provider failover (production hardening).
- Account/device recovery for anonymous sessions (product decision still pending).
