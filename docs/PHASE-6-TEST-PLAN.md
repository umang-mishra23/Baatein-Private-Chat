# Phase 6 security test plan

Run this on the updated Phase 5 project without resetting the database.

## Automated checks

```powershell
npx prisma generate
npm run lint
npm test
npm audit
```

## Same-origin / CSRF

- From the app in the same browser origin, logout, send a message, block a user, submit a report, and cancel an invitation; all should work.
- Send a state-changing API request with `Origin: https://attacker.example`; expect `403`.
- Send a state-changing request with no `Origin` and no valid same-origin `Referer`; expect `403`.
- Send a request with `Sec-Fetch-Site: cross-site`; expect `403`.
- In local development, localhost and the configured tunnel origin should work. Production should not allow localhost unless explicitly configured.

## Request size / validation

- Send malformed JSON to a message/report API; expect `400`, not `500`.
- Send a body beyond that endpoint's limit; expect `413`.
- Send `text/plain` to a JSON endpoint; expect `415`.
- Submit invalid UUIDs and extra fields to Socket.IO message/join/read/delete events; they should be rejected with generic acknowledgements and no stack trace.

## Realtime

- Try a Socket.IO handshake without `Origin`; it should be refused.
- Try a disallowed origin; it should be refused.
- Revoke a session in Privacy Center, then send a socket event from its old connection; it should disconnect/reject the event.
- Send duplicate `clientMessageId` values for the same sender/conversation; there must not be duplicate message rows.
- Exceed per-user message, join, typing, read, or delete limits; requests should be rejected with generic messages.
- Attempt to send/read/delete in a conversation as a non-member; it must be unavailable.
- Attempt message send while blocked; it must be rejected through both REST and Socket.IO.

## Data exposure / logging

- Inspect chat, message, invitation and privacy API responses; no raw phone numbers, session hash, Twilio credentials, invitation token or ciphertext should be returned unless specifically necessary.
- Inspect security logs from invite/report actions; log metadata should be allowlisted and should not contain message text, recipient phone or token.
- Check database message fields; message content remains encrypted at rest.

## Limits

The automated tests are not a substitute for database-backed race-condition/integration tests, dependency audits, or an external penetration test. Redis-backed rate limiting, shared realtime presence, and nonce-based production CSP remain deployment work.
