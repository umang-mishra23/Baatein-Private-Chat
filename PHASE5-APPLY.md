# Private Chat — Phase 5 incremental patch

This is a cumulative update for the existing Phase 4 project. It is **not** a replacement project. It intentionally does not include `.env`, `package.json`, your database credentials, or a full Prisma schema, and it does not touch the PostgreSQL data directory.

## Back up before applying

From `D:\private-chat`, close editors that may overwrite files, then run:

```powershell
Copy-Item .env .env.phase4-backup
Copy-Item prisma\schema.prisma prisma\schema.phase4-backup.prisma
Copy-Item prisma\migrations prisma\migrations.phase4-backup -Recurse
```

If you use Git, commit your current working Phase 4 state first.

## Apply the files

1. Extract this ZIP **into the existing `D:\private-chat` directory**, merging folders. It contains only files changed or added for Phase 5. If Windows asks to overwrite a file, the listed replacement files below are intentional.
2. In PowerShell:

```powershell
cd D:\private-chat
.\scripts\apply-phase5-schema.ps1
npx prisma format
npx prisma generate
npx prisma migrate dev
```

The schema script adds only `ConversationMember.hiddenAt` and its index. The additive migration creates that nullable column and index. Do not run `prisma migrate reset`, drop the database, or overwrite `.env`.
3. Run checks:

```powershell
npm run lint
npm test
```

4. Restart your existing app stack:

```powershell
npm run dev:all
```

Keep your current `.env`, Twilio/Fast2SMS integration, database URLs, encryption secrets, Caddyfile, Next config, ngrok config and local DB data. None are included in this patch.

## What Phase 5 adds

- Block user from chat; enforce bidirectional message blocking in backend services.
- Report the other participant with fixed reason categories and bounded optional details.
- Delete your own messages; server replaces stored ciphertext with an encrypted deletion marker and realtime clients receive a deletion event.
- Hide a conversation for yourself without deleting the other participant's history.
- Privacy Center lists blocked users and active sessions; unblock users and revoke other sessions.
- Explicit permanent anonymous-identity deletion, which revokes sessions, clears profile identifiers and invitation routing fields, deletes this identity's conversations/message history for both participants, removes blocks and anonymizes linked security/report references where supported.

## Known Phase 5 boundaries

- This is still server-side encrypted messaging, not E2EE.
- Report records are stored but no moderator/admin console or automated abuse adjudication is provided yet.
- The current rate limiter is process-local; multi-instance production needs a shared store such as Redis.
- Message deletion broadcasts through Socket.IO and therefore needs an active realtime connection to notify both browsers immediately.
- Permanent identity deletion removes entire conversations involving that identity, including their message history for the other participant. The UI requires typing `DELETE` before proceeding.
- Public exposure of a development server through ngrok is for temporary testing only, not production hosting.

See `docs/PHASE-5-TEST-PLAN.md` for manual tests.
