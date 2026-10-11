# Phase 6 — Security hardening

This phase is an additive security update to the existing accountless Phase 4/5 application. It does not change the database schema and therefore requires **no Prisma migration**.

## Implemented in this patch

- Cookie-authenticated mutating APIs require a valid same-origin `Origin` or `Referer`; cross-site Fetch Metadata is rejected. The configured app/realtime origins are allowed, and local origins are allowed only in development.
- Session bootstrap and logout now use the same CSRF/origin policy as other mutations.
- JSON API bodies are parsed through a byte-bounded reader and return 400/413/415 for malformed, oversized, or unsupported payloads.
- Message-history reads and message sends are rate-limited per anonymous user; sends have an additional IP-hash bucket.
- The in-memory rate-limit map is bounded to prevent unbounded memory growth. This limiter is still process-local.
- Socket.IO has a payload-size cap, strict origin/session handshake checks, validated payload shapes/UUIDs, per-user event throttles, and session revalidation on sensitive events.
- Socket message events now preserve the client idempotency UUID; retries through Socket.IO follow the same deduplication mechanism as REST.
- Security-log metadata is allowlisted. Message content, phone numbers, raw tokens and arbitrary metadata keys are discarded.
- API/invitation responses are marked `no-store`; request IDs are restricted to a safe character set.
- Prisma configuration no longer falls back to a hard-coded PostgreSQL `postgres` superuser URL if `DATABASE_URL` is missing.
- Production CSP no longer permits `unsafe-eval`; the development-only CSP still permits it for Next dev tooling.
- Added tests for origin policy, bounded JSON parsing, rate limits, metadata redaction, Socket.IO payload validation, and invitation-acceptance validation.

## Apply

1. Back up the existing project/config first.
2. Copy/merge only the files in the Phase 6 patch into the existing project. Do not replace the project folder.
3. Keep your local `.env` private and unchanged, except ensure `SHADOW_DATABASE_URL` is present. The patch does not include `.env`.
4. Run:

```powershell
npx prisma generate
npm run lint
npm test
```

No schema migration is expected for Phase 6.

## Tests

Run all tests:

```powershell
npm test
```

The automated tests cover pure security policies and validation. They do not replace two-browser integration tests or a deployment-level pen test.

## Production blockers / limitations

- The rate limiter remains process-local; use a shared Redis-backed atomic limiter before using multiple web/realtime instances or scaling invitations publicly.
- Configure `TRUSTED_PROXY_HOPS` and test proxy IP handling at the deployment edge. The production default is fail-closed to `unknown`; set the hop count only after the trusted reverse proxy is configured to normalize `X-Forwarded-For`. Do not trust arbitrary client-supplied forwarding headers.
- The CSP still allows `unsafe-inline` for script/style compatibility with this Next.js scaffold. A stronger nonce-based CSP should be implemented and tested against the actual production build before claiming strong XSS mitigation.
- Realtime presence uses an in-memory map and needs a shared adapter/store for multi-instance deployment.
- There is no automated abuse-review/moderation dashboard. Reports are stored, not automatically investigated.
- E2EE is not implemented. Messages are encrypted at rest by the server and this must not be advertised as end-to-end encryption.
- A full integration test against the developer's local PostgreSQL/Twilio/ngrok setup and a production build must be run on that machine.
- Keep SMS routes compliant with the recipient country's telecom rules and provider/account restrictions.

## Pre-production checklist

- [ ] Run `npm audit` and review fixes without blindly running `npm audit fix --force`.
- [ ] Run `npm run lint`, `npm test`, and `npm run build` on the actual Windows project.
- [ ] Use HTTPS and a stable public hostname; stop exposing the development server directly.
- [ ] Ensure production secrets are generated independently, rotated if exposed, and managed outside source control.
- [ ] Use a least-privileged runtime DB role separate from the migration owner.
- [ ] Replace the process-local rate limiter and presence map before horizontal scaling.
- [ ] Test authorization from a non-member identity, blocked-user behavior, replay/race cases, CSRF rejection, malformed payloads, and revoked sessions.
- [ ] Review production CSP and logging retention/privacy with the actual deployment.
