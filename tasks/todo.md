# Todo — TikTok LIVE Ingestion

## Define / research
- [x] Select TikTok ingestion as PR #8 direction.
- [x] Review current TikTok for Developers product/scope/comment documentation.
- [x] Confirm no documented first-party real-time TikTok LIVE-comment API was found in the public developer surface.
- [x] Review current unofficial `tiktok-live-connector` dependency/license/transport constraints.
- [x] Review managed Euler Stream WebSocket option.
- [x] Write `docs/specs/tiktok-live-ingestion.md`.
- [ ] Product owner approves source option A/B/C.
- [ ] Product owner confirms one-session/manual-start/shared-queue MVP assumptions.
- [ ] Product owner confirms TikTok TTS format (`username: comment`) or updates requirement.

## TDD transport adapter
- [ ] Add RED tests for creator input parsing and connect/stop lifecycle.
- [ ] Add RED tests for external event validation/normalization/dedup identity.
- [ ] Add RED tests for stale callback isolation and bounded reconnect/error handling.
- [ ] Add RED tests for provider-secret redaction.
- [ ] Implement the approved transport adapter.
- [ ] Focused adapter tests GREEN.

## HTTP / queue / UI
- [ ] Add bounded server-side TikTok start/stop API contract.
- [ ] Feed normalized TikTok comments into the existing shared FIFO/TTS pipeline.
- [ ] Keep Facebook sessions independent from TikTok connect/stop/failure.
- [ ] Add safe TikTok start/stop/status UI using `textContent` only.
- [ ] Preserve playback-owner and pause/resume behavior.
- [ ] Add integration/boundary tests.

## Verification
- [ ] `npm ci` PASS in CI.
- [ ] `npm run typecheck` PASS.
- [ ] `npm test` PASS.
- [ ] `npm run build` PASS, including `node --check web/app.js`.
- [ ] Ubuntu CI PASS.
- [ ] Windows CI PASS.
- [ ] Dependency/supply-chain review completed for any new package/service.
- [ ] Self-review completed with no remaining Required findings.

## Runtime merge gate
- [ ] Connect to a real TikTok LIVE using the approved transport.
- [ ] Pre-connect/initial history is not replayed as new speech.
- [ ] New viewer comment reaches recent UI/shared queue/TTS.
- [ ] TikTok TTS matches the approved text-format contract.
- [ ] Stop TikTok while Facebook remains active; Facebook continues normally.
- [ ] Browser storage/URLs/API/SSE/server logs contain zero provider-secret occurrences.
- [ ] Record sanitized evidence in `tasks/capture-findings.md`.
- [ ] Mark PR #8 Ready only after runtime gate passes.

Current status: **BLOCKED ON SOURCE DECISION**. No TikTok production connector code will be written until the external transport choice is explicitly approved.
