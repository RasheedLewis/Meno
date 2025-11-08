## Realtime WebSocket Schema (API Gateway)

This document captures the message contract that both the Lambda handlers and the clients use when talking over the API Gateway WebSocket. The route selection expression is `request.body.action`; all clients send JSON envelopes that follow these shapes.

### Connection Metadata (query string on `$connect`)

| Field          | Type                               | Notes                               |
| -------------- | ---------------------------------- | ----------------------------------- |
| `sessionId`    | `string`                           | Required; canonical session id      |
| `participantId`| `string`                           | Required; stable participant id     |
| `name`         | `string`                           | Required; display name              |
| `role`         | `"student" \| "teacher" \| "observer"` | Required                            |
| `client`       | `"web" \| "tablet" \| "native"`    | Required; used for analytics        |

The `$connect` Lambda validates these fields and stores them in `meno-connections` keyed by `(sessionId, connectionId)`.

### Client → Server Actions

```ts
type WebsocketClientEnvelope =
  | { action: "chat.send"; payload: ChatSendPayload }
  | { action: "presence.update"; payload: PresenceUpdatePayload }
  | { action: "presence.heartbeat"; payload: PresenceHeartbeatPayload }
  | { action: "control.lease.set"; payload: ControlLeaseSetPayload }
  | { action: "control.lease.release"; payload: ControlLeaseReleasePayload }
  | { action: "system.ping"; payload?: Record<string, never> };
```

Key payloads:

- **`chat.send`**  
  ```ts
  interface ChatSendPayload {
    messageId: string;
    content: string;
    createdAt?: string; // ISO8601; server will fill if omitted
    meta?: Record<string, unknown>; // structured extras (attachments, tags, etc.)
  }
  ```

- **`presence.update`**  
  ```ts
  interface PresenceUpdatePayload {
    status?: "online" | "typing" | "speaking" | "muted" | "reconnecting";
    isTyping?: boolean;
    isSpeaking?: boolean;
    lastSeen?: string; // ISO8601
    extra?: Record<string, unknown>; // client specific metadata (cursor colors, etc.)
  }
  ```

- **`presence.heartbeat`**  
  ```ts
  interface PresenceHeartbeatPayload {
    lastSeen?: string; // server defaults to now
  }
  ```

- **`control.lease.set`**  
  ```ts
  interface ControlLeaseSetPayload {
    leaseId?: string; // optional client hint
    stepIndex: number;
    leaseDurationMs?: number; // server caps to policy
  }
  ```

- **`control.lease.release`**  
  ```ts
  interface ControlLeaseReleasePayload {
    leaseId?: string;
  }
  ```

- **`system.ping`** – lightweight keepalive; server responds with `"system.pong"`.

### Server → Client Broadcasts

```ts
type WebsocketServerEnvelope =
  | ChatMessageBroadcast
  | ChatSyncBroadcast
  | PresenceSnapshotBroadcast
  | PresenceEventBroadcast
  | LeaseStateBroadcast
  | SystemPongBroadcast;
```

- **`chat.message`** – single message appended.  
  ```ts
  interface ChatMessageBroadcast {
    type: "chat.message";
    data: {
      sessionId: string;
      messageId: string;
      participantId: string;
      participantName: string;
      role: "student" | "teacher" | "observer";
      content: string;
      createdAt: string;
      meta?: Record<string, unknown>;
    };
  }
  ```

- **`chat.sync`** – initial history on connect.  
  ```ts
  interface ChatSyncBroadcast {
    type: "chat.sync";
    data: {
      sessionId: string;
      messages: ChatMessageBroadcast["data"][];
    };
  }
  ```

- **`presence.snapshot`** – complete participant roster (on connect or large changes).  
  ```ts
  interface PresenceSnapshotBroadcast {
    type: "presence.snapshot";
    data: {
      sessionId: string;
      participants: Array<{
        participantId: string;
        name: string;
        role: "student" | "teacher" | "observer";
        status: "online" | "typing" | "speaking" | "muted" | "reconnecting" | "offline";
        isTyping: boolean;
        isSpeaking: boolean;
        color?: string;
        lastSeen: string;
        extra?: Record<string, unknown>;
      }>;
    };
  }
  ```

- **`presence.event`** – delta update for a single participant.

- **`control.lease.state`** – authoritative lease info (`leaseId`, `stepIndex`, `leaseTo`, issued/expires timestamps).

- **`system.pong`** – replies to `system.ping` with the server timestamp.

### Routing Summary

| Action / Type              | Lambda Route             | Persistence                                      |
| -------------------------- | ------------------------ | ------------------------------------------------ |
| `chat.send`                | `sendChatMessage`        | Write to `meno-chat`, broadcast `chat.message`   |
| `presence.update`          | `updatePresence`         | Upsert `meno-presence`, broadcast `presence.event` |
| `presence.heartbeat`       | `heartbeatPresence`      | Touch TTLs in `meno-presence`                    |
| `control.lease.set`        | `setLease`               | Update session record, broadcast `control.lease.state` |
| `control.lease.release`    | `releaseLease`           | Clear lease, broadcast `control.lease.state`     |
| `system.ping`              | `ping`                   | Reply with `system.pong`                         |

All broadcasts use the API Gateway Management API to fan messages to every connection stored for the session. Lambdas should prune gone connections when the Management API returns `410 Gone`.

These TypeScript definitions live in `src/lib/realtime/schema.ts` so both the web/tablet clients and the Lambda handlers can share literal action names and payload shapes.

