# Remote Access — Implementation Tasks

## Backend

- [x] Define WebSocket protocol types (ServerMessage, ClientMessage) in `electron/remote/protocol.ts`
- [x] Implement message parsing with validation (`parseClientMessage`)
- [x] Implement ring buffer for scrollback storage (`electron/remote/ring-buffer.ts`)
- [x] Create HTTP server with static file serving and path traversal protection
- [x] Add REST API endpoints (`/api/agents`, `/api/agents/:agentId`)
- [x] Set up WebSocket server with connection cap and payload limit
- [x] Implement token generation (24 bytes, base64url)
- [x] Implement timing-safe token comparison
- [x] Add first-message auth flow with 5-second timeout
- [x] Add legacy URL query parameter auth (backward compatibility)
- [x] Implement agent list building with shell filtering and task deduplication
- [x] Wire up PTY event listeners (spawn, exit, list-changed) for broadcasting
- [x] Implement subscribe/unsubscribe with scrollback replay
- [x] Handle client disconnect (unsubscribe all, clean up auth state)
- [x] Detect WiFi and Tailscale network interfaces for URL generation

## IPC Integration

- [x] Add `StartRemoteServer`, `StopRemoteServer`, `GetRemoteStatus` IPC channels
- [x] Register IPC handlers in `electron/ipc/register.ts`
- [x] Track server state (token, port, URLs, connected clients) in app store

## Frontend (Desktop)

- [x] Add remote access toggle in settings/UI
- [x] Display connection URL and QR code
- [x] Show connected client count
- [x] Support start/stop server lifecycle

## Remote SPA (Mobile)

- [x] Set up separate Vite build for `src/remote/`
- [x] Implement WebSocket client with first-message auth
- [x] Store token in localStorage for reconnection
- [x] Build agent list view with status indicators
- [x] Integrate xterm.js for terminal rendering
- [x] Add input support (keyboard on mobile)
- [x] Handle resize events
- [x] Mobile-responsive layout
