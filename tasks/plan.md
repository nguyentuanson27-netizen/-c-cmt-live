# Plan — Facebook Page Live Discovery

## Task 1 — Lock discovery contract

**Acceptance criteria**
- Define server-only Graph discovery, safe browser response shape, trusted-origin requirement, and manual operator selection.
- Keep current token/version model, 9-live cap, polling, queue, TTS, and manual Live ID/URL flow unchanged.
- Record that current Meta Page live-video discovery semantics require real runtime verification before merge-ready.

**Verification**
- Spec is reviewed against current server security boundaries and deferred scope.

## Task 2 — TDD the Graph discovery client

**Acceptance criteria**
- Add RED tests before implementation.
- Request `/<configured-version>/me/live_videos` with `broadcast_status=LIVE`, bounded `limit`, and safe metadata fields.
- Send Page token only through Authorization header.
- Validate/bound returned metadata and handle malformed responses safely.
- Surface code 190 as invalid/expired token without exposing secrets.

**Verification**
- Focused tests fail because discovery implementation is absent, while existing tests remain green.
- After implementation, focused discovery tests pass.

## Task 3 — Wire local HTTP and operator UI

**Acceptance criteria**
- Add trusted-origin `GET /api/facebook/live-videos`.
- Return 503 for missing server config and 502 for Graph discovery failures.
- Add **Tìm live đang phát** control and result list.
- Result **Thêm** action reuses the existing `/api/facebook/start` path.
- Render Graph metadata with text nodes only.
- Empty/error discovery states are understandable; discovery does not mutate active lives.

**Verification**
- Boundary/source tests cover route/UI security contract where practical.
- `node --check web/app.js` remains green.

## Task 4 — Full verification and runtime gate

**Acceptance criteria**
- Typecheck, all tests, and build pass on Ubuntu + Windows.
- Self-review finds no Required correctness/security/architecture issue.
- Real managed Page with an active live proves discovery returns that live and operator can connect it.
- Browser/network/SSE/log secret-leak check remains zero token occurrences.

**Verification**
```bash
npm ci
npm run typecheck
npm test
npm run build
```

Keep PR #7 Draft until real Meta runtime evidence is recorded in `tasks/capture-findings.md`.
