# Implementation Plan — Facebook Graph Multi-Live

The single-live Graph web runtime is proven and merged. This phase scales that exact runtime to **2–9 concurrent Facebook Lives** without changing the token boundary or TTS product contract.

## Dependency graph

```text
Task 1 Multi-live manager + RED/GREEN tests
        ↓
Task 2 Per-live queue/source isolation
        ↓
Task 3 HTTP/SSE + operator UI for add/stop individual lives
        ↓
Task 4 Full CI + self-review
        ↓
Task 5 Two-live real runtime verification
```

## Task 1 — Multi-live lifecycle manager

**Acceptance criteria:**
- [x] Add `FacebookLiveManager` around independent `FacebookGraphCommentPoller` instances.
- [x] Reject duplicate live IDs without disturbing the active session.
- [x] Enforce a hard cap of 9 across active + pending starts.
- [x] Concurrent starts cannot race past the cap.
- [x] Failed baseline/start does not consume a slot or affect other lives.
- [x] Token-expiry/error in one poller removes only that live from manager state.
- [x] Stop one and stop-all are isolated and idempotent at the HTTP behavior boundary.

**Verification:** focused manager tests written RED first, then full suite.

## Task 2 — Shared FIFO with per-live isolation

**Acceptance criteria:**
- [x] Graph comments carry `sourceId = facebook-graph:<liveVideoId>`.
- [x] Content dedup state is scoped per live so identical comments on different lives do not collide.
- [x] Add a generic queue selective-removal primitive if needed.
- [x] Stopping one live removes only waiting items from that source; currently processing/playing audio may finish.
- [x] Adding a live never clears existing queue items.
- [x] Stop-all clears all waiting queue items.

**Verification:** queue/source regression tests + full suite.

## Task 3 — Web API/SSE/UI

**Acceptance criteria:**
- [x] `/api/facebook/start` adds a live instead of replacing all sessions.
- [x] `/api/facebook/stop` accepts an optional `liveVideoId`; omitted means stop-all for compatibility.
- [x] `/api/status` and SSE snapshot expose active live IDs/count without exposing secrets.
- [x] Status/comment events identify the source live.
- [x] UI shows up to 9 active live IDs with individual Stop controls plus Stop all.
- [x] Existing TTS pause/clear/playback-owner behavior remains unchanged.
- [x] UI and server validate all request payloads and remain loopback-only.

**Verification:** focused boundary tests, keyboard/basic accessibility review, full typecheck/tests/build. Browser runtime verification is part of Task 5 because this session has no browser/DevTools tool.

## Task 4 — Automated verification and review

**Acceptance criteria:**
- [x] `npm run typecheck` PASS.
- [x] `npm test` PASS (75/75 on implementation head).
- [x] `npm run build` PASS, including browser JS syntax check and runtime-module guard.
- [x] Ubuntu + Windows CI PASS on implementation head.
- [x] Self-review: correctness → security → architecture → simplicity → performance.
- [x] One Required idempotent-stop finding was fixed; no remaining Required code findings.

## Task 5 — Runtime merge gate

**Acceptance criteria:**
- [ ] Connect two real managed Facebook Lives at the same time.
- [ ] Existing comments baseline independently on both lives.
- [ ] A marker comment on Live A and one on Live B both reach the UI and shared queue.
- [ ] TTS speaks only comment content and plays the two items sequentially without overlap.
- [ ] Stopping Live A leaves Live B receiving/reading new comments.
- [ ] Page token remains absent from browser storage/URLs/SSE/logs.
- [ ] Observed Graph→app latency for both live sources is recorded.

**Verification:** runtime evidence recorded in `tasks/capture-findings.md` before merge-ready.
