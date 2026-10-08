# Phase 4 — Private 1-to-1 Realtime Chat

## Implemented

- Conversation-safe REST APIs for listing conversations and cursor-paginated messages.
- Server-side membership checks for every conversation/message operation.
- Server-side message encryption using `MESSAGE_ENCRYPTION_KEY`; plaintext is never persisted.
- Cursor pagination based on `(createdAt, id)` ordering; message history is not loaded all at once.
- Socket.IO authentication using the existing HttpOnly `pc_session` cookie.
- Exact origin enforcement for realtime connections.
- Server-side authorization on `conversation:join`, `message:send`, typing events, read receipts, and message deletion.
- Realtime message delivery with acknowledgements.
- Client-generated message idempotency keys with a database uniqueness constraint to make retry-after-timeout safe.
- Delivery state: SENT → DELIVERED → READ.
- Online/offline presence within conversation rooms.
- Typing indicators.
- Read receipt persistence with `ConversationMember.lastReadMessageId`.
- Block-aware message authorization; either direction blocking prevents new messages.
- REST fallback when the realtime socket is unavailable.
- Mobile-first chat screen with keyboard-safe composer, safe-area padding, skeleton loading, long-message wrapping, timestamps, delivery ticks, and light/dark theme support.
- Initial invitation message is now inserted into message history with a recipient receipt.
- Message deletion event is available to the sender through realtime.

## Privacy boundary

The chat API returns only:

- internal UUIDs where required for server authorization/UI state
- usernames
- message text after server-side decryption
- timestamps
- delivery/read metadata

Phone numbers, encrypted phone fields, invitation tokens, session secrets, and raw provider identifiers are never included in chat responses or Socket.IO events.

This phase uses **server-side encrypted/private chat**. It is **not end-to-end encrypted** because the server has the message decryption key.

## Realtime deployment

The current Socket.IO service is intentionally a separate Node process (`npm run dev:realtime`) so it can run on infrastructure that supports long-lived WebSocket connections.

The presence map and the rate limiter are process-local. Before horizontal scaling, production should add:

- a shared Redis rate-limit store
- a Socket.IO Redis adapter (or equivalent pub/sub layer)
- explicit sticky-session/load-balancer strategy where required by the chosen transport/configuration
- metrics and connection lifecycle monitoring

Do not deploy the realtime service on an environment that terminates long-lived WebSocket processes unexpectedly.

## Routes

- `GET /api/conversations`
- `GET /api/conversations/:conversationId/messages?cursor=<cursor>&limit=<n>`
- `POST /api/conversations/:conversationId/messages`
- `POST /api/conversations/:conversationId/read`
- `/dashboard/chat/:conversationId`

## Socket events

Client → server:

- `conversation:join`
- `conversation:leave`
- `message:send`
- `typing:start`
- `typing:stop`
- `conversation:read`
- `message:delete`

Server → client:

- `message:new`
- `message:delivery`
- `presence:update`
- `typing:update`
- `message:deleted`
