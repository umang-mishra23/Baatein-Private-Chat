# Architecture

## Core privacy boundary

The product is intentionally **accountless** from the user's perspective.

`User.id` + `username` is chat identity. A phone number is not a user identity and is never attached to a persistent account profile. During the invitation phase, the phone number exists only as encrypted delivery data inside an invitation record plus a keyed lookup value when deterministic matching is required.

### Request path

Browser → Next.js route handler → authenticated anonymous session → business service → Prisma → PostgreSQL.

The client never supplies an authoritative user ID for protected operations. The server derives the current user from the HttpOnly session cookie.

### Anonymous identity path

1. User selects **Start privately**.
2. The server creates a random user UUID with no phone number and no password.
3. The server creates a random 256-bit session secret and stores only its HMAC in the database.
4. The secret is placed in an HttpOnly, Secure production cookie with SameSite protection.
5. The user chooses a username.
6. The server stores both display username and a normalized uniqueness key.
7. The session is rotated when the username is claimed.

Clearing the browser cookie ends access to the local anonymous identity unless a later recovery mechanism is added. This is an explicit MVP privacy/usability trade-off.

### Invitation path

1. Normalize the destination phone server-side.
2. Create a random 32-byte invitation token.
3. HMAC the token and persist only the HMAC.
4. Store the destination number encrypted at rest plus a keyed lookup hash for invitation operations.
5. Send the SMS through the provider abstraction.
6. Acceptance later atomically consumes the invitation and creates conversation membership.

The raw invite token is never stored in the database.

### Chat path

Every conversation read/write must first verify membership. WebSocket room joins must perform the same authorization; a room name is never an authorization decision.

## Data minimization

Do not put phone numbers, invite tokens, auth tokens or message bodies into application logs, analytics events, client storage or URLs.

The current anonymous identity model has no email/password/OTP tables because there is no conventional account-sign-in flow.

## Session model

Sessions are server-side rows keyed by `idHash`. The browser only receives the raw random secret via an HttpOnly cookie. Sessions expire after a configurable application-defined lifetime and can be explicitly revoked by logout. The server periodically refreshes `lastSeenAt` without rotating the secret on every request.

## Message confidentiality

The project does not claim E2EE. The message field is named `ciphertext` so server-side encryption-at-rest can be explicit, but the product must not advertise end-to-end encryption until a reviewed E2EE protocol exists.

## Scaling

The included rate limiter is intentionally process-local for development. Before horizontal production deployment it must move to Redis or another shared, atomic store. Socket.IO should use an adapter/managed realtime layer when multiple realtime instances are deployed.
