# ADR 0002 — Web runtime with Facebook Graph API

## Status

Accepted — current active runtime. Supersedes ADR 0001.

## Context

The Electron/browser-DOM approach proved comment-capture feasibility but introduced rendering delay, remote-page lifecycle complexity and fragile DOM coupling. The product direction changed to a web operator UI with direct Facebook Graph API ingestion for managed Pages.

## Decision

Use a local Node.js HTTP server as the trusted boundary. Keep the Facebook Page Access Token and Graph API version in server environment variables. Poll Live Video comments from the backend, push normalized events to the browser over SSE, synthesize TTS on the server and let the browser play returned audio.

The server binds to loopback only in the current product. Public hosting, authentication and webhook infrastructure are separate decisions.

The single-live Graph path was later extended to 2–9 concurrent live sessions with independent poller lifecycles and one shared bounded FIFO/TTS pipeline. After that path passed real two-live runtime verification, the obsolete Electron implementation was removed in the focused cleanup described by `docs/specs/remove-legacy-electron.md`.

## Consequences

### Positive
- No Facebook DOM parsing or Electron/BrowserWindow runtime in the repository's active path.
- Secrets stay outside browser storage.
- Polling lifecycle, pagination and multi-live isolation are directly testable.
- SSE is sufficient for one-way status/comment/audio events and avoids unnecessary WebSocket infrastructure.
- The repository has one runtime/build path instead of carrying a desktop harness beside the web app.

### Negative
- Requires a managed Page token with the permissions available to the target Meta app.
- Runtime behavior still depends on Meta API permissions/version and must be tested with the real Page when Graph behavior changes.
- Polling latency remains subject to the configured interval and Graph response time.
- TikTok/Shopee web ingestion is not provided by this decision and remains deferred.

## Rejected alternatives

- Continue patching the Electron IPC/DOM integration: rejected because it retained the runtime and coupling being replaced.
- Store Page token in browser localStorage: rejected because it exposes a sensitive bearer credential to client-side code/storage.
- Webhooks in the first slices: rejected because polling is simpler and does not require public HTTPS callback infrastructure.
- Keep dead Electron code as rollback: rejected after the Graph replacement was proven; git history and ADR 0001 are the rollback/history source.
