# Implementation Plan — Facebook Graph Web Runtime

This plan supersedes the Electron multi-live continuation for the active Facebook path. The existing Electron work remains historical evidence until the web Graph path passes runtime verification.

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
- [ ] Parse numeric Live Video IDs and Facebook video URLs; reject unrelated hosts.
- [ ] Page token is sent only in `Authorization: Bearer ...`, never URL/log/browser.
- [ ] Initial newest comment is a baseline boundary; existing comments are not emitted.
- [ ] Polling paginates until the previous boundary so >1 page of new comments is not silently lost.
- [ ] Pagination has a hard page cap and reports inability to catch up instead of silently advancing the boundary.
- [ ] Stop/restart aborts/discards stale in-flight work.
- [ ] Token error stops the connector cleanly.

**Verification:** focused tests + full suite.

## Task 2 — Local HTTP + SSE

**Acceptance criteria:**
- [ ] Server defaults to `127.0.0.1`.
- [ ] Token/API version are read from server env only.
- [ ] Browser can start/stop a live by ID/URL and read status.
- [ ] SSE emits status/comments/queue/playback events with bounded client state.
- [ ] Request body size/type is validated.
- [ ] Security headers/CSP are set for the static UI.

**Verification:** server boundary tests + full suite.

## Task 3 — Queue/TTS integration

**Acceptance criteria:**
- [ ] Comments use existing normalization/filtering.
- [ ] Dedup scope includes the live source.
- [ ] Existing queue max/stale semantics remain intact.
- [ ] Edge TTS spoken text remains exactly `username: comment`.
- [ ] Server emits one playback item at a time and waits for browser completion before advancing.

**Verification:** existing queue/TTS tests + new source-scope/playback-boundary tests.

## Task 4 — Runtime gate

**Acceptance criteria:**
- [ ] Real managed Facebook Page live receives an exact test marker and viewer username through Graph API.
- [ ] Comments present before connect are not spoken.
- [ ] Two quick comments play sequentially without overlap.
- [ ] Observed end-to-end comment latency is recorded.
- [ ] No token appears in browser storage/network URLs/log output.

**Verification:** manual browser/runtime evidence recorded in `tasks/capture-findings.md`.

## Task 5 — Follow-up

After Task 4 passes, remove/deprecate obsolete Facebook DOM/Electron runtime in a focused PR, then reintroduce 2→9 Facebook multi-live on the proven Graph connector. TikTok/Shopee strategy is a separate product decision.
