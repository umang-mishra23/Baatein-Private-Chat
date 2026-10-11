# Phase 5 test plan

Run after the schema field is added and the migration is applied.

## Setup

```powershell
npx prisma format
npx prisma generate
npx prisma migrate dev
npm run lint
npm test
```

Use two browser sessions for the two anonymous test users. Don't test destructive identity deletion against any identity you intend to keep.

## Block / unblock

1. Open an existing conversation as User A.
2. Use the header menu -> Block user.
3. Confirm User A is redirected to Privacy Center and the conversation disappears from A's list.
4. Attempt to send a new message from User B. The server should reject it with a generic unavailable/blocked response; it must not save a new message.
5. Privacy Center -> Unblock. The conversation should reappear for A and messaging should resume.
6. Verify `BlockedUser` has no row after unblock.

## Report

1. Open an existing conversation and choose Report user.
2. Submit a supported reason and optional details.
3. Verify one `Report` row exists with the expected reporterId, peer reportedUserId, conversationId, reason, and OPEN status.
4. Confirm the UI never reveals recipient/sender phone numbers and server logs don't include report details.
5. Send more than 5 reports in the configured in-memory window; excess requests should return HTTP 429.

## Delete a message

1. Send a message as User A.
2. Use the trash action on that message while Socket.IO is connected and confirm.
3. Both clients should show `Message deleted` without refresh.
4. Check that the message row has `deletedAt` set and its ciphertext has been replaced by an encrypted deletion marker. The original message text should not remain in the database.
5. Try deleting another user's message via a forged event; the server should reject it.

## Delete conversation for self

1. User A selects Delete conversation and confirms.
2. The conversation should disappear from A's list only.
3. User B should still see the conversation and their history.
4. If User B sends a new message, the hidden conversation should reappear for User A (unless A blocked B).
4. A direct fetch of the deleted conversation's message API as A should fail as unavailable.
5. Unrelated conversations must remain unchanged.

## Session management

1. Sign into the same identity in two separate sessions (where available).
2. Privacy Center should identify the current session without showing any session secret/hash.
3. Revoke other sessions; the current browser remains active and another session must be rejected on its next authenticated request/socket handshake.

## Identity/data deletion

Use a disposable test identity only.

1. Privacy Center -> Delete identity and chat data; type `DELETE`.
2. The current session is revoked and browser returns to the landing page.
3. The user row is anonymized (DELETED, no username, usernameNormalized, or avatar URL).
4. Sessions are revoked, sent invitations no longer contain encrypted recipient phone/first-message fields, blocks are removed, related conversations and messages are deleted, and security events are disassociated from the user.
5. Reports may remain for safety-review purposes with identity/conversation references anonymized where supported.

## Security negative tests

- A non-member cannot list messages or delete a conversation by guessing a UUID.
- A blocked user cannot post via REST or Socket.IO.
- A report request with an arbitrary reportedUserId is not accepted; reported identity is derived from server-verified conversation membership.
- Mutating requests from an incorrect Origin are rejected.
- Chat API responses do not include phone numbers, session hashes, SMS credentials, or invitation tokens.
