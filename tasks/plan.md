# Implementation Plan — Facebook Graph Web Runtime

This plan supersedes the Electron multi-live continuation for the active Facebook path. The existing Electron implementation remains historical/rollback code until the Graph path passes real-live verification.

## Dependency graph

```text
Task 1 Graph connector + TDD
        ↓
Task 2 Local HTTP/SSE runtime
        ↓
Task 3 Existing core queue + Edge TTS browser playback
        ↓
Task 4 Real Page live runtime verification
        ↓
Task 5 Retire legacy Electron Facebook path / then multi-live
```

## Task 1 — Graph connector

**Acceptance criteria:**
- [x] Parse numeric Live Video IDs and Facebook video URLs; reject unrelated hosts.
- [x] Page token is sent only in `Authorization: Bearer ...`, never URL/log/browser.
- [x] Initial newest comment is a baseline boundary; existing comments are not emitted.
- [x] Polling paginates until the previous boundary so >1 page of new comments is not silently lost.
- [x] Pagination has a hard page cap and reports inability to catch up instead of silently advancing the boundary.
- [x] Stop/restart aborts/discards stale in-flight work.
- [x] Token error stops the connector cleanly and reports the real token-expiry error.

**Verification:** 6 focused Graph connector tests plus the full repository suite. TDD evidence includes RED for the missing connector and RED for the token-expiry regression before each GREEN implementation.

## Task 2 — Local HTTP + SSE

**Acceptance criteria:**
- [x] Server defaults to `127.0.0.1` and refuses non-loopback binding.
- [x] Token/API version are read from server env only.
- [x] Browser can start/stop a live by ID/URL and read status.
- [x] SSE emits status/comments/queue/playback events with bounded recent UI state.
- [x] Request body size/type is validated.
- [x] Security headers/CSP are set for the static UI.

**Verification:** focused server-boundary/playback tests plus full typecheck/tests/build in CI.

## Task 3 — Queue/TTS integration

**Acceptance criteria:**
- [x] Comments use existing normalization/filtering.
- [x] Single-live dedup state is reset on each successful connection attempt and comment source identity includes the Live Video ID.
- [x] Existing queue max/stale semantics remain intact.
- [x] Edge TTS spoken text remains exactly `username: comment`.
- [x] Server emits one playback item at a time and waits for matching browser completion before advancing.
- [x] Pause/resume and clear-waiting-queue controls remain available in the web UI.

**Verification:** existing core/TTS tests + browser playback bridge tests + full repository suite.

## Task 4 — Runtime gate

**Acceptance criteria:**
- [ ] Verify the actual `FACEBOOK_GRAPH_API_VERSION` supported by the Meta app and the Page token permissions against official Meta/App Dashboard information.
- [ ] Real managed Facebook Page live receives an exact test marker and viewer username through Graph API.
- [ ] Comments present before connect are not spoken.
- [ ] Two quick comments play sequentially without overlap.
- [ ] Observed end-to-end comment latency is recorded.
- [ ] Browser storage/network URLs/log output contain no Page token.

**Verification:** manual browser/runtime evidence recorded in `tasks/capture-findings.md`.

## Task 5 — Follow-up

After Task 4 passes, remove/deprecate obsolete Facebook DOM/Electron runtime in a focused PR, then reintroduce 2→9 Facebook multi-live on the proven Graph connector. TikTok/Shopee strategy is a separate product decision.
