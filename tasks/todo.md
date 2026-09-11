# Web Graph Migration Todo

## Define / plan
- [x] Confirm web app replaces Windows Electron as active operator runtime.
- [x] Confirm Facebook Graph API replaces Facebook DOM capture.
- [x] Record server-side token boundary and loopback-first deployment.
- [x] Record migration ADR and implementation plan.

## Task 1 — Facebook Graph connector
- [x] RED tests for ID/URL validation and connector contract.
- [x] RED test that access token is not placed in request URL.
- [x] Test baseline + new comment emission.
- [x] Test multi-page burst catch-up.
- [x] Test stop/restart stale-request isolation.
- [x] RED regression test for code-190 token expiry, followed by GREEN fix.
- [x] Failed replacement start keeps the current live active until the replacement baseline succeeds.
- [x] Implement connector and make focused tests GREEN.

## Task 2 — Web server/SSE
- [x] Add loopback HTTP server and static web UI.
- [x] Read `FACEBOOK_PAGE_ACCESS_TOKEN` and `FACEBOOK_GRAPH_API_VERSION` server-side only.
- [x] Add start/stop/status endpoints with bounded JSON parsing.
- [x] Add SSE event stream and security headers.
- [x] Deliver each playback event to one browser client only; transfer ownership after that SSE client disconnects.
- [x] Accept IPv4/hostname/IPv6 loopback forms, including bracketed IPv6 origins.
- [x] Add focused server-boundary tests.

## Task 3 — Core/TTS
- [x] Reset single-live dedup state only after a replacement live starts successfully and retain Live Video ID in source identity.
- [x] Route Graph comments through normalize → dedup → bounded FIFO queue.
- [x] Synthesize Edge TTS on server using existing exact `username: comment` formatting.
- [x] Send one audio item at a time to browser and await matching playback completion.
- [x] Keep pause/resume/clear queue controls.

## Automated verification
- [x] Full `npm run typecheck` PASS on code head `b6e65f9465f92220a1882bbb2e3a90e3a1395166`.
- [x] Full `npm test` PASS: 62/62 on code head `b6e65f9465f92220a1882bbb2e3a90e3a1395166`.
- [x] Full `npm run build` + runtime-module guard PASS on code head `b6e65f9465f92220a1882bbb2e3a90e3a1395166`.
- [x] CI PASS on Ubuntu + Windows for code head `b6e65f9465f92220a1882bbb2e3a90e3a1395166`.
- [x] Security/code self-review: no token in browser storage, Graph URL, logs or SSE payloads; browser cannot submit a token; local runtime refuses non-loopback binding; failed replacement starts preserve the current live/queue; playback is single-browser-owned.

## Runtime verification — merge gate
- [ ] Verify the actual Meta Graph API version and Page token permissions for the target Page/app.
- [ ] Real managed Facebook Page comment PASS with exact username + marker text.
- [ ] Existing comments remain baseline-only after connect.
- [ ] Two quick comments play sequentially without overlap.
- [ ] Record observed Graph→app / end-to-end latency.
- [ ] Inspect browser storage, requests and server logs to confirm the Page token is absent.
- [x] Keep PR Draft until the runtime gate above is complete.

## Deferred
- [ ] 2→9 Facebook lives after single-live Graph runtime passes.
- [ ] Remove legacy Electron Facebook path in a focused cleanup after Graph runtime passes.
- [ ] Decide TikTok/Shopee web ingestion strategy separately.
