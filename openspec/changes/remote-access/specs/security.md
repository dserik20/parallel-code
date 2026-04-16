# Security Specification

## Authentication

### Token Generation
- 24 random bytes, base64url-encoded (32 characters)
- Generated once per server session using `crypto.randomBytes()`
- Not persisted — new token each time the server starts

### Token Delivery
- Primary: first WebSocket message `{ type: "auth", token: "..." }`
- Fallback: URL query parameter `?token=...`
- REST API: `Authorization: Bearer <token>` header, or `?token=` query parameter

### Token Comparison
- Timing-safe comparison via `crypto.timingSafeEqual()` to prevent timing attacks
- Buffer length check before comparison (different lengths fail fast — acceptable since length is constant)

### Unauthenticated Connection Handling
- WebSocket connections have 5 seconds to authenticate before forced close (code `4001`)
- REST API routes under `/api/` return `401 Unauthorized` immediately
- Unauthenticated WebSocket clients cannot receive or send any messages

## Connection Limits

- Maximum 10 concurrent WebSocket connections (enforced in `verifyClient`)
- Excess connections rejected with HTTP `429`

## Input Validation

- WebSocket payload max: 64 KB
- Input data max: 4096 characters per message
- Agent ID max: 100 characters
- Terminal resize bounds: 1-500 for both cols and rows
- Auth token max: 200 characters
- Invalid/malformed messages are silently dropped (no error response)

## HTTP Security Headers

All HTTP responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`

## Static File Serving

- Path traversal prevention: resolved path must be within the static directory (relative path check, rejects `..`)
- SPA fallback: unknown paths serve `index.html` (no directory listing)
- Cache policy: HTML is `no-cache`, assets are immutable with 1-year max-age

## Network Binding

- Server binds to `0.0.0.0` (all interfaces) on the configured port
- Detects WiFi and Tailscale IPs for generating access URLs
- Tailscale IPs identified by `100.x.x.x` range
- Docker/container IPs (`172.x.x.x`) are excluded from WiFi detection
