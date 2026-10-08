# Phase 2 — Accountless Anonymous Identity

## Product decision

Traditional account creation is removed.

There is no password account, email account, phone login, or OTP sign-in in the MVP. A browser creates an anonymous internal user and authenticates with a server-side session cookie.

## Implemented

- `POST /api/session/bootstrap`: creates the anonymous user/session once per browser.
- `GET /api/me`: returns only `{ id, username }`.
- `PATCH /api/me`: claims/changes the username and rotates the current session.
- `POST /api/session/logout`: revokes the current server-side session.
- `/start`: mobile-first anonymous identity setup flow.
- `/dashboard`: protected server-side route; missing session or username redirects to `/start`.
- Dashboard logout action.
- Username uniqueness is enforced using a normalized server-side key.
- Session secrets are random 32-byte values; only an HMAC is stored.
- Session cookies are HttpOnly and SameSite=strict; Secure is enabled in production.
- Session last-seen timestamps are updated periodically.
- Anonymous identity bootstrap is rate-limited per IP hash.

## Explicit trade-off

The browser session is currently the credential. Clearing cookies or losing the session loses access to that anonymous identity. Recovery is deliberately not invented in Phase 2 and should be a separate privacy/UX decision before launch.

## Database change

Removed:

- `PhoneIdentity`
- `VerificationCode`
- phone-backed user authentication fields

Changed:

- `User.username` is nullable until claimed.
- `User.usernameNormalized` provides case-insensitive uniqueness semantics.
- `Invitation.recipientPhoneEncrypted` holds the invitation destination number only.

## Phase 3 boundary

Invitation creation, SMS delivery, token validation, atomic consumption, and recipient conversation creation are not exposed as fake client functionality yet. They remain isolated in the invitation service foundation for the next phase.
