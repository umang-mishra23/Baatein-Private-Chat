# Phase 6 patch — apply to the existing project

This is an **incremental patch** for the existing Phase 5 project. It is not a replacement project. It includes no `.env`, no PostgreSQL data, no Prisma schema changes, and no new migration.

## Before extracting

From PowerShell:

```powershell
cd D:\private-chat
Copy-Item .env .env.phase5-backup
Copy-Item prisma.config.ts prisma.config.phase5-backup.ts
Copy-Item proxy.ts proxy.phase5-backup.ts
Copy-Item server\realtime.ts server\realtime.phase5-backup.ts
Copy-Item server\http.ts server\http.phase5-backup.ts
```

If your project is in Git, commit the current working Phase 5 state first. Backups must remain private because `.env` contains secrets. The updated `.gitignore` ignores `.env.*` and backup files while re-including `.env.example`.

## Extract

Extract the ZIP into `D:\private-chat`, merge folders, and allow replacement of files with the same path. Do not extract a complete Phase 1–4 project ZIP over your folder.

The patch intentionally replaces security-sensitive implementation files, including `proxy.ts`, `server/csrf.ts`, `server/http.ts`, `server/realtime.ts`, `server/rate-limit/index.ts`, `server/logger.ts`, `lib/validation.ts`, `prisma.config.ts`, and the listed API routes. It adds `server/security/origin-policy.ts`, two Phase 6 test files, and Phase 6 documentation.

Your `.env`, PostgreSQL databases, existing users/conversations, `prisma/schema.prisma`, and `prisma/migrations` are not included or overwritten by extraction. `.env.example` is only a sample template and is updated to remove insecure default superuser credentials.

## Check environment

Make sure `.env` still contains valid values for:

- `DATABASE_URL`
- `SHADOW_DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `REALTIME_ORIGIN`
- `NEXT_PUBLIC_REALTIME_URL`
- the existing session, encryption, lookup and invitation secrets

The actual `NEXT_PUBLIC_APP_URL` / `REALTIME_ORIGIN` should match the currently active app origin(s). If you use ngrok, its hostname can change between sessions. Retain the `allowedDevOrigins` entry in `next.config.ts` for the current development hostname if your Next.js version requires it.

`TRUSTED_PROXY_HOPS` is optional in local development. In production, set it only after configuring the edge proxy to normalize forwarding headers and determining the exact trusted proxy hop count. Incorrect values make IP-based limits inaccurate.

## Validate (no migration)

Phase 6 does not change the Prisma schema. Do **not** run `prisma migrate reset` or create a migration for this patch.

```powershell
npx prisma generate
npm run lint
npm test
npm audit
npm run build
```

Review `npm audit` output separately; do not blindly run `npm audit fix --force` because it can make breaking ORM changes.

Then restart `npm run dev:all`. Keep Caddy and ngrok running if you are testing from a phone.

## Main behavior changes

- Mutating cookie-authenticated API requests require an allowed same-origin Origin/Referer and reject `Sec-Fetch-Site: cross-site`.
- Invalid/oversized JSON receives bounded, generic error responses.
- REST message history/sends and sensitive realtime events are rate-limited.
- Socket.IO payloads are validated; message idempotency keys are preserved on the realtime path.
- Security log metadata is explicitly allowlisted.
- Prisma no longer falls back to a hard-coded `postgres:postgres` connection URL when configuration is missing.

See `docs/PHASE-6-TEST-PLAN.md` for manual abuse/authorization checks.
