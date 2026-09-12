# Facebook Graph Multi-Live Todo

## Define / plan
- [x] Single-live Graph web runtime merged to `main` at `c62ed6841ab951473f96ccb86ec0570c67a0592a`.
- [x] Confirm next phase is 2→9 concurrent Facebook Lives.
- [x] Keep one shared FIFO/TTS pipeline; FB-API speech remains comment content only.
- [x] Keep Page token and Graph version server-side only.
- [x] Record multi-live spec and implementation plan.

## Task 1 — Multi-live lifecycle manager
- [x] RED tests for 2+ independent live sessions.
- [x] RED test for duplicate start isolation.
- [x] RED test for 9-live active+pending cap and concurrent-start race.
- [x] RED test that one live error/stop does not terminate another.
- [x] Regression coverage ensures inactive/error sessions leave manager state before status forwarding.
- [x] Implement `FacebookLiveManager` and make focused tests GREEN.

## Task 2 — Queue/source isolation
- [x] Preserve distinct `facebook-graph:<liveVideoId>` source IDs.
- [x] Scope content dedup per live.
- [x] Add generic selective queue removal with tests.
- [x] Stop one live removes only its waiting queue items; adding a live does not clear the queue.
- [x] Repeated stop-one is a safe no-op and does not affect other lives.
- [x] Stop-all clears all waiting queue items.

## Task 3 — HTTP/SSE/UI
- [x] Start endpoint adds a live without replacing existing lives.
- [x] Stop endpoint can stop one live or all lives.
- [x] Status/SSE expose active live IDs/count without secrets.
- [x] UI lists active live IDs with individual Stop buttons and Stop all.
- [x] Status/comment events identify source live.
- [x] Recent/current UI uses comment content and Live ID rather than viewer-name dependence.
- [x] Existing pause/resume/clear queue and single-browser playback ownership remain intact.

## Automated verification
- [x] `npm run typecheck` PASS on implementation head.
- [x] `npm test` PASS: 75/75 on implementation head.
- [x] `npm run build` PASS, including `node --check web/app.js` and runtime-module guard.
- [x] Ubuntu CI PASS on implementation head.
- [x] Windows CI PASS on implementation head.
- [x] Self-review completed: one Required idempotent-stop finding fixed; no remaining Required code findings.

## Runtime verification — merge gate
- [ ] Two real Facebook Lives connected simultaneously.
- [ ] Both lives baseline existing comments independently.
- [ ] Marker comment from Live A reaches UI/shared queue/TTS.
- [ ] Marker comment from Live B reaches UI/shared queue/TTS.
- [ ] Shared TTS is sequential and speaks comment content only.
- [ ] Stop Live A leaves Live B active and still receiving comments.
- [ ] Page token absent from browser storage/URLs/SSE/logs.
- [ ] Record Graph→app latency for both sources in `tasks/capture-findings.md`; no PR #5 multi-live runtime evidence has been recorded yet.

## Deferred
- [ ] More than 9 concurrent Facebook Lives.
- [ ] Auto-discovery of Page live videos.
- [ ] Per-live voices/queues.
- [ ] Public hosting/authentication/webhooks.
- [ ] Remove legacy Electron Facebook path in a focused cleanup.
- [ ] Decide TikTok/Shopee web ingestion strategy separately.
