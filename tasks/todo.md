# Web Graph Migration Todo

## Define / plan
- [x] Confirm web app replaces Windows Electron as active operator runtime.
- [x] Confirm Facebook Graph API replaces Facebook DOM capture.
- [x] Record server-side token boundary and loopback-first deployment.
- [x] Record migration ADR and implementation plan.

## Task 1 — Facebook Graph connector
- [ ] RED tests for ID/URL validation.
- [ ] RED test that access token is not placed in request URL.
- [ ] RED test for baseline + new comment emission.
- [ ] RED test for multi-page burst catch-up.
- [ ] RED test for stop/restart stale-request isolation.
- [ ] Implement connector and make focused tests GREEN.

## Task 2 — Web server/SSE
- [ ] Add loopback HTTP server and static web UI.
- [ ] Read `FACEBOOK_PAGE_ACCESS_TOKEN` and `FACEBOOK_GRAPH_API_VERSION` server-side only.
- [ ] Add start/stop/status endpoints with bounded JSON parsing.
- [ ] Add SSE event stream and security headers.
- [ ] Add server boundary tests.

## Task 3 — Core/TTS
- [ ] Scope dedup by live source without breaking legacy tests.
- [ ] Route Graph comments through normalize → dedup → queue.
- [ ] Synthesize Edge TTS on server.
- [ ] Send one audio item at a time to browser and await playback completion.
- [ ] Keep pause/resume/clear queue controls.

## Verify/review
- [ ] Full `npm run typecheck` PASS.
- [ ] Full `npm test` PASS.
- [ ] Full `npm run build` PASS.
- [ ] CI PASS on Ubuntu + Windows.
- [ ] Security review: no token in browser storage, URL, logs or SSE payloads.
- [ ] Runtime real Facebook Page comment PASS.
- [ ] Record observed latency.
- [ ] Keep PR Draft until runtime gate is complete.

## Deferred
- [ ] 2→9 Facebook lives after single-live Graph runtime passes.
- [ ] Remove legacy Electron Facebook path in a focused cleanup after Graph runtime passes.
- [ ] Decide TikTok/Shopee web ingestion strategy separately.
