# Todo — Facebook Page Live Discovery

## Define / plan
- [x] Choose focused PR #7 scope: discover active managed-Page lives, operator selects, existing start flow connects.
- [x] Keep Page token/API version server-side and preserve current 9-live/polling/queue/TTS behavior.
- [x] Write discovery spec and implementation plan.

## TDD discovery client
- [x] Add RED tests for Graph discovery request/auth/filter/normalization/error handling.
- [x] Confirm RED fails only because discovery implementation is missing/unfinished.
- [x] Implement bounded server-side Graph discovery.
- [x] Discovery tests GREEN.
- [x] Add RED regressions for malformed successful envelopes and redact-before-bound error handling.
- [x] Harden response validation/token redaction and return those regressions GREEN.

## HTTP / UI
- [x] Add trusted-origin `GET /api/facebook/live-videos`.
- [x] Add **Tìm live đang phát** UI and safe result rendering.
- [x] Reuse existing `/api/facebook/start` when operator selects a discovered live.
- [x] Preserve manual ID/URL entry and all current multi-live behavior.
- [x] Preserve explicit not-yet-searched, empty, and error discovery UI states.

## Verification
- [x] `npm ci` PASS in CI.
- [x] `npm run typecheck` PASS.
- [x] `npm test` PASS.
- [x] `npm run build` PASS, including `node --check web/app.js`.
- [x] Ubuntu CI PASS.
- [x] Windows CI PASS.
- [x] Self-review completed with no remaining Required findings.

## Runtime merge gate
- [ ] Real managed Page has at least one active live during discovery test.
- [ ] Discovery returns the expected active Live Video ID without exposing the Page token.
- [ ] Operator adds that discovered live and existing baseline/comment/TTS flow connects successfully.
- [ ] Browser storage/network URLs/SSE/server logs contain zero Page-token occurrences.
- [ ] Record evidence in `tasks/capture-findings.md`.
- [ ] Mark PR #7 Ready only after the runtime gate passes.

Runtime gate status: **NOT RUN in this agent session**. No browser/DevTools runtime or Facebook Page credential/live session is available here, so the real-Meta gate must remain pending rather than inferred from mocks/CI.
