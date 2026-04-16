# WebSocket Protocol Specification

## Connection Flow

1. Client connects to `ws://<host>:<port>`
2. Client sends `{ type: "auth", token: "<token>" }` as the first message
3. Server validates token (timing-safe comparison) and sends back the current agent list
4. If auth fails, server closes connection with code `4001` ("Unauthorized")
5. Unauthenticated connections are closed after 5 seconds

Legacy flow: token may also be provided as a `?token=` query parameter on the WebSocket URL. The first-message auth flow is preferred because it avoids tokens appearing in proxy logs or browser history.

## Server -> Client Messages

### `agents`
Sent on connect and whenever the agent list changes (spawn, exit).

```json
{
  "type": "agents",
  "list": [
    {
      "agentId": "uuid",
      "taskId": "uuid",
      "taskName": "Add JWT auth",
      "status": "running",
      "exitCode": null,
      "lastLine": "Implementing middleware..."
    }
  ]
}
```

- Deduplicated by taskId (one entry per task, prefers running agent over exited)
- Shell/sub-terminals are excluded (only main agents shown)

### `output`
Live terminal output for a subscribed agent.

```json
{ "type": "output", "agentId": "uuid", "data": "<base64>" }
```

### `scrollback`
Full terminal history sent when subscribing to an agent.

```json
{ "type": "scrollback", "agentId": "uuid", "data": "<base64>", "cols": 120 }
```

### `status`
Agent status change (currently only sent on exit).

```json
{ "type": "status", "agentId": "uuid", "status": "exited", "exitCode": 0 }
```

## Client -> Server Messages

### `auth`
First message to authenticate. Token max length: 200 chars.

```json
{ "type": "auth", "token": "base64url-encoded-token" }
```

### `subscribe` / `unsubscribe`
Subscribe to live output for a specific agent. Subscribing sends the full scrollback first, then streams new output.

```json
{ "type": "subscribe", "agentId": "uuid" }
{ "type": "unsubscribe", "agentId": "uuid" }
```

### `input`
Send terminal input to an agent. Data max length: 4096 chars.

```json
{ "type": "input", "agentId": "uuid", "data": "yes\n" }
```

### `resize`
Resize an agent's terminal. Cols and rows must be integers between 1 and 500.

```json
{ "type": "resize", "agentId": "uuid", "cols": 80, "rows": 24 }
```

### `kill`
Kill a running agent.

```json
{ "type": "kill", "agentId": "uuid" }
```

## Validation Rules

- All messages are JSON. Invalid JSON is silently dropped.
- `type` must be a string.
- `agentId` must be a string, max 100 chars.
- Unknown message types are silently dropped.
- Max WebSocket payload: 64 KB.
- Max concurrent connections: 10.

## REST API

### `GET /api/agents`
Returns the current agent list (same format as the `agents` WebSocket message `list` field).

### `GET /api/agents/:agentId`
Returns agent details including scrollback.

```json
{
  "agentId": "uuid",
  "scrollback": "<base64>",
  "status": "running",
  "exitCode": null
}
```

All API routes require authentication via `Authorization: Bearer <token>` header or `?token=` query parameter.
