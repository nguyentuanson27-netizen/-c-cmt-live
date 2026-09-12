# ADR 0002 — Web runtime with Facebook Graph API

## Status

Proposed for this PR; supersedes ADR 0001 for the active Facebook runtime once the Graph path passes real-live verification.

## Context

The Electron/browser-DOM approach proved comment capture feasibility but introduced rendering delay, remote-page lifecycle complexity and fragile DOM coupling. The product direction is now a web operator UI with direct Facebook Graph API ingestion for managed Pages.

## Decision

Use a local Node.js HTTP server as the trusted boundary. Keep Facebook Page Access Token and Graph API version in server environment variables. Poll the Live Video comments edge from the backend, push normalized events to the browser over SSE, synthesize TTS on the server and let the browser play returned audio.

The server binds to loopback by default. Public hosting, authentication and webhook infrastructure are separate decisions.

## Consequences

### Positive
- No Facebook DOM parsing or BrowserWindow runtime in the active Facebook path.
- Secrets stay outside browser storage.
- Polling lifecycle and pagination are directly testable.
- SSE is sufficient for one-way status/comment/audio events and avoids unnecessary WebSocket infrastructure.

### Negative
- Requires a managed Page token with the permissions needed by the target Graph API operation.
- Runtime behavior still depends on Meta API permissions/version and must be tested with the real Page.
- Legacy Electron code remains temporarily until the web path is proven and can be removed in a focused cleanup.

## Rejected alternatives

- Continue patching PR #3 Electron IPC integration: too much coupling to the runtime being replaced.
- Store Page token in browser localStorage: rejected because it exposes a sensitive bearer credential to client-side code/storage.
- Webhooks in the first slice: rejected because polling is simpler and does not require public HTTPS callback infrastructure.
