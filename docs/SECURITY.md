# Security baseline

## Threats addressed in Phases 2–3

- Session secret guessing: 256-bit random session secrets, HMAC-only persistence.
- Session fixation: session rotation when an anonymous identity claims a username.
- CSRF: SameSite cookies plus same-origin checks for state-changing API requests.
- XSS: React output encoding, controlled rendering, CSP baseline, no raw HTML chat renderer.
- SQL injection: Prisma parameterized queries only.
- IDOR/BOLA: protected resources use the authenticated server-side user; clients cannot choose the authoritative user ID.
- User enumeration: username update errors remain generic; there is no phone-based login lookup endpoint.
- Abuse: anonymous bootstrap is rate-limited per IP hash, and invitation creation/resend/acceptance have user/IP limits and cooldowns. Distributed production limits still require a shared store.
- Data leakage: raw phone numbers are outside chat identity DTOs and are never part of the anonymous session object.

## Accountless model

There is no traditional account creation or sign-in in the product. A browser session creates an anonymous internal user record and a server-side session. The user then claims a username.

This means the browser session is the credential. Clearing cookies or losing the session currently means losing access to that anonymous identity. A recovery mechanism can be added later without turning the phone number into public chat identity.

## Production requirements before launch

1. Use HTTPS everywhere and enable HSTS.
2. Put secrets in a managed secret store; never commit `.env`.
3. Replace the process-local limiter with Redis or an equivalent atomic store.
4. Add request IDs and security-event retention policies, plus an SMS delivery outbox/worker for crash-safe provider submission.
5. Add automated regression tests for IDOR/BOLA, invitation race conditions, authentication bypass, CSRF and phone-number leakage.
6. Review the CSP using production nonces where required by the final Next.js rendering setup.
7. Put the realtime service behind the same trust boundary and verify sessions server-side before any socket room join or message action.
8. Add anti-automation controls before allowing unrestricted anonymous invitation generation.
9. Independently review any E2EE implementation before enabling E2EE product claims.

## Privacy regression rule

A test should fail if an API response, websocket event, browser storage write, URL, analytics event or structured log contains a raw phone number.
