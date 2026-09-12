# Facebook Graph Multi-Live Todo

## Define / plan
- [x] Single-live Graph web runtime merged to `main` at `c62ed6841ab951473f96ccb86ec0570c67a0592a`.
- [x] Confirm next phase is 2→9 concurrent Facebook Lives.
- [x] Keep one shared FIFO/TTS pipeline; FB-API speech remains comment content only.
- [x] Keep Page token and Graph version server-side only.
- [x] Record multi-live spec and implementation plan.

## Task 1 — Multi-live lifecycle manager
- [ ] RED tests for 2+ independent live sessions.
- [ ] RED test for duplicate start isolation.
- [ ] RED test for 9-live active+pending cap and concurrent-start race.
- [ ] RED test that one live error/stop does not terminate another.
- [ ] Implement `FacebookLiveManager` and make focused tests GREEN.

## Task 2 — Queue/source isolation
- [ ] Preserve distinct `facebook-graph:<liveVideoId>` source IDs.
- [ ] Scope content dedup per live.
- [ ] Add generic selective queue removal with tests.
- [ ] Stop one live removes only its waiting queue items; adding a live does not clear the queue.
- [ ] Stop-all clears all waiting queue items.

## Task 3 — HTTP/SSE/UI
- [ ] Start endpoint adds a live without replacing existing lives.
- [ ] Stop endpoint can stop one live or all lives.
- [ ] Status/SSE expose active live IDs/count without secrets.
- [ ] UI lists active live IDs with individual Stop buttons and Stop all.
- [ ] Status/comment events identify source live.
- [ ] Existing pause/resume/clear queue and single-browser playback ownership remain intact.

## Automated verification
- [ ] `npm run typecheck` PASS.
- [ ] `npm test` PASS.
- [ ] `npm run build` PASS.
- [ ] Ubuntu CI PASS on exact head.
- [ ] Windows CI PASS on exact head.
- [ ] Self-review has no Required findings.

## Runtime verification — merge gate
- [ ] Two real Facebook Lives connected simultaneously.
- [ ] Both lives baseline existing comments independently.
- [ ] Marker comment from Live A reaches UI/shared queue/TTS.
- [ ] Marker comment from Live B reaches UI/shared queue/TTS.
- [ ] Shared TTS is sequential and speaks comment content only.
- [ ] Stop Live A leaves Live B active and still receiving comments.
- [ ] Page token absent from browser storage/URLs/SSE/logs.
- [ ] Record Graph→app latency for both sources in `tasks/capture-findings.md`.

## Deferred
- [ ] More than 9 concurrent Facebook Lives.
- [ ] Auto-discovery of Page live videos.
- [ ] Per-live voices/queues.
- [ ] Public hosting/authentication/webhooks.
- [ ] Remove legacy Electron Facebook path in a focused cleanup.
- [ ] Decide TikTok/Shopee web ingestion strategy separately.
