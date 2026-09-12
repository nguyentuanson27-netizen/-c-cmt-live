# Todo — Facebook Page Live Discovery

## Define / plan
- [x] Choose focused PR #7 scope: discover active managed-Page lives, operator selects, existing start flow connects.
- [x] Keep Page token/API version server-side and preserve current 9-live/polling/queue/TTS behavior.
- [x] Write discovery spec and implementation plan.

## TDD discovery client
- [ ] Add RED tests for Graph discovery request/auth/filter/normalization/error handling.
- [ ] Confirm RED fails only because discovery implementation is missing/unfinished.
- [ ] Implement bounded server-side Graph discovery.
- [ ] Discovery tests GREEN.

## HTTP / UI
- [ ] Add trusted-origin `GET /api/facebook/live-videos`.
- [ ] Add **Tìm live đang phát** UI and safe result rendering.
- [ ] Reuse existing `/api/facebook/start` when operator selects a discovered live.
- [ ] Preserve manual ID/URL entry and all current multi-live behavior.

## Verification
- [ ] `npm ci` PASS.
- [ ] `npm run typecheck` PASS.
- [ ] `npm test` PASS.
- [ ] `npm run build` PASS.
- [ ] Ubuntu CI PASS.
- [ ] Windows CI PASS.
- [ ] Self-review completed with no Required findings.

## Runtime merge gate
- [ ] Real managed Page has at least one active live during discovery test.
- [ ] Discovery returns the expected active Live Video ID without exposing the Page token.
- [ ] Operator adds that discovered live and existing baseline/comment/TTS flow connects successfully.
- [ ] Browser storage/network URLs/SSE/server logs contain zero Page-token occurrences.
- [ ] Record evidence in `tasks/capture-findings.md`.
- [ ] Mark PR #7 Ready only after the runtime gate passes.
