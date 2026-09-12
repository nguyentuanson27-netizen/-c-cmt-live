# Todo — TikTok LIVE Ingestion

## Define / research
- [x] Select TikTok ingestion as PR #8 direction.
- [x] Review current TikTok for Developers product/scope/comment documentation.
- [x] Confirm no documented first-party real-time TikTok LIVE-comment API was found in the public developer surface.
- [x] Review current unofficial `tiktok-live-connector` dependency/license/transport constraints.
- [x] Review managed Euler Stream WebSocket option and current official provider docs.
- [x] Product owner approves **A — Euler Stream managed WebSocket**.
- [x] Lock MVP: one TikTok session, manual creator start, shared FIFO/TTS, no gifts/follows/discovery.
- [x] Lock TikTok TTS format: `username: comment`.
- [x] Update `docs/specs/tiktok-live-ingestion.md` with provider/security/reconnect contract.

## TDD provider boundary
- [ ] Add RED tests for creator input parsing and fixed provider WebSocket URL/auth.
- [ ] Add RED tests for external bundle validation/normalization and provider-secret redaction.
- [ ] Implement parser/provider boundary.
- [ ] Focused parser/security tests GREEN.

## TDD lifecycle / processor
- [ ] Add RED tests for one-session connect/stop lifecycle.
- [ ] Add RED tests for stale callbacks, terminal close behavior, bounded reconnect policy.
- [ ] Add RED tests for TikTok processor dedup/source identity.
- [ ] Implement lifecycle/session + processor.
- [ ] Focused lifecycle/processor tests GREEN.

## HTTP / queue / UI
- [ ] Add server-only `EULER_API_KEY` config and bounded TikTok start/stop request contract.
- [ ] Feed normalized TikTok comments into the existing shared FIFO/TTS pipeline.
- [ ] Stop TikTok removes only waiting TikTok queue items.
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
- [x] Supply-chain decision: no new TikTok runtime package; use Node 24 stable built-in WebSocket and fixed Euler provider API.
- [ ] Self-review completed with no remaining Required findings.

## Runtime merge gate
- [ ] Connect to a real TikTok LIVE with an actual server-side Euler API key.
- [ ] Provider connection does not replay old comments as new speech.
- [ ] New viewer comment reaches recent UI/shared queue/TTS.
- [ ] TikTok TTS reads `username: comment`.
- [ ] Stop TikTok while Facebook remains active; Facebook continues normally.
- [ ] Exercise a provider close/reconnect or terminal-close path where practical.
- [ ] Browser storage/URLs/API/SSE/server logs contain zero Euler API-key occurrences.
- [ ] Record sanitized evidence in `tasks/capture-findings.md`.
- [ ] Mark PR #8 Ready only after runtime gate passes.

Current status: **SOURCE APPROVED — IMPLEMENTATION IN PROGRESS**. PR #8 remains Draft until the runtime gate passes.