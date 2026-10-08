# Phase 4 Security Test Plan

These are the integration cases to execute against a real PostgreSQL database and running realtime service.

1. Authenticated session can list only its own conversations.
2. Unauthenticated conversation API requests return 401.
3. A session that is not a conversation member cannot read message history.
4. A session that is not a conversation member cannot send a message.
5. A user blocked by either participant cannot send a message.
6. Message API never returns `ciphertext`.
7. Conversation API never returns invitation phone fields.
8. Cursor pagination never returns more than the requested page size.
9. A malformed cursor is rejected without a database exception leaking to the client.
10. Socket.IO rejects connections with no/invalid session cookie.
11. Socket.IO rejects a non-allowlisted Origin.
12. Socket.IO rejects conversation joins for non-members.
13. Socket.IO rejects message sends for non-members.
14. Realtime message delivery creates exactly one message and one recipient receipt even if the client retries after an acknowledgement timeout.
15. Rejoining a conversation upgrades SENT receipts to DELIVERED.
16. Read acknowledgement upgrades DELIVERED receipts to READ only for messages authored by the peer.
17. Typing events are emitted only to an authorized conversation room.
18. Message deletion can only be performed by the message sender.
19. Expired/revoked sessions are rejected by both HTTP and Socket.IO.
20. Raw message bodies, invitation tokens, session secrets and phone numbers are absent from security logs.
