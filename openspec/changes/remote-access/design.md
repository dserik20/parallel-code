# Remote Access — Technical Design

## Architecture Overview

```
┌─────────────────┐     HTTP/WS      ┌──────────────────┐
│  Mobile Browser  │ ◄─────────────► │  Remote Server    │
│  (SPA client)    │                  │  (Node.js)        │
└─────────────────┘                  └────────┬─────────┘
                                              │
                                     ┌────────▼─────────┐
                                     │  PTY Manager      │
                                     │  (agent processes) │
                                     └──────────────────┘
```

The remote server is an HTTP + WebSocket server embedded in the Electron main process. It serves a mobile-optimized SPA and provides real-time agent communication over WebSocket.

## Components

### 1. HTTP Server (`electron/remote/server.ts`)

Single `http.createServer` instance handling:
- **Static file serving**: serves the pre-built remote SPA from disk
- **REST API**: `/api/agents` and `/api/agents/:agentId` for initial data loads
- **WebSocket upgrade**: `ws` library mounted on the same HTTP server

The server is started/stopped on demand via IPC (`StartRemoteServer` / `StopRemoteServer`). Only one instance runs at a time.

### 2. WebSocket Layer

Uses the `ws` library (`WebSocketServer`) with:
- `maxPayload: 64KB` — prevents memory abuse
- `verifyClient` — enforces 10-connection cap
- Per-client subscription tracking via `WeakMap<WebSocket, Map<agentId, callback>>`
- Authenticated client tracking via `Set<WebSocket>`

Connection lifecycle:
1. `connection` event → start auth timer (5s)
2. First message → validate token → add to authenticated set → send agent list
3. Subsequent messages → dispatch to PTY operations
4. `close` event → unsubscribe all agent listeners, clean up

### 3. Agent List Building

`buildAgentList()` constructs the agent list by:
- Iterating all active agent IDs from the PTY manager
- Filtering out shell/sub-terminals (`isShell`)
- Deduplicating by taskId (preferring running agents)
- Enriching with task name and status from callbacks

Broadcast triggers:
- `spawn` event → refreshes full list
- `list-changed` event → refreshes full list
- `exit` event → sends status change + delayed list refresh (100ms)

### 4. Ring Buffer (`electron/remote/ring-buffer.ts`)

Fixed-capacity circular buffer (default 64KB) for terminal scrollback:
- Stores raw terminal bytes
- On `subscribe`, dumps entire buffer as base64 for initial replay
- Handles data larger than capacity by keeping only the tail
- Separate from the main terminal scrollback (lightweight, remote-only)

### 5. Remote SPA (`src/remote/`)

Separate Vite build target producing a standalone SPA:
- Connects via WebSocket with first-message auth
- Renders agent list and terminal output using xterm.js
- Responsive layout optimized for phone screens
- Token stored in localStorage for reconnection

## Data Flow

### Live Output Streaming
```
PTY output → subscribeToAgent callback → ws.send(output message) → client xterm
```

### User Input
```
Client xterm keypress → ws.send(input message) → writeToAgent(agentId, data) → PTY stdin
```

### Scrollback Replay
```
Client subscribes → getAgentScrollback(agentId) → ws.send(scrollback) → client xterm.write
```

## Key Decisions

1. **First-message auth over URL auth**: Tokens in URLs leak through proxy logs, browser history, and Referer headers. First-message auth keeps the token in the WebSocket frame only.

2. **WeakMap for per-client state**: Subscription maps and auth timers use WeakMap keyed by WebSocket, so cleanup is automatic when the client disconnects and the WebSocket is garbage collected.

3. **Bind to 0.0.0.0**: Required for access from other devices on the network. The token-based auth protects against unauthorized access.

4. **Separate SPA build**: The remote UI has different dependencies (no Electron APIs, mobile layout) and is served as static files. Keeping it as a separate Vite build avoids bundling Electron-specific code.

5. **No persistent scrollback**: The ring buffer is in-memory only. If the app restarts, scrollback is lost. This keeps the implementation simple and avoids disk I/O for a monitoring feature.
