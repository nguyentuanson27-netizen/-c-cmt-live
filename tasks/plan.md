# Plan — TikTok LIVE ingestion via Euler Stream

## Task 1 — Provider boundary + parser

**Acceptance criteria**
- Parse creator username / `@username` / canonical TikTok LIVE URL without server-side user-controlled fetches.
- Build only `wss://ws.eulerstream.com` URLs with server API key, explicit schema v2, decoded bundled events.
- Parse bounded JSON bundles and extract only `WebcastChatMessage` records.
- Normalize username/text/id defensively and redact provider secrets from errors.

**Verification**
- RED tests fail before module exists.
- Focused parser/security tests pass after implementation.

**Dependencies:** None

## Task 2 — One-session lifecycle + reconnect

**Acceptance criteria**
- At most one active/pending TikTok session.
- Start resolves on WebSocket open; conflict does not replace active session.
- Manual stop is idempotent, clears reconnect timers, and invalidates stale callbacks.
- Retry documented transient close classes at 1/2/4/8/16 seconds, max 5 attempts.
- Terminal auth/offline/end closes do not retry.

**Verification**
- Fake-WebSocket lifecycle tests cover start, stop, stale callbacks, transient retry cap, terminal close.

**Dependencies:** Task 1

## Task 3 — Normalize into shared comment/TTS pipeline

**Acceptance criteria**
- TikTok comments use source `tiktok-euler:<uniqueId>` and `sourceLabel: TT-EULER`.
- Dedup recent same-user/same-text comments for this one session.
- Queue/TTS/playback remain shared with Facebook.
- Stop TikTok removes only waiting TikTok queue items.
- Facebook manager/session state is untouched by TikTok failures.

**Verification**
- Processor tests and queue integration assertions pass.

**Dependencies:** Tasks 1–2

## Task 4 — HTTP/SSE/UI slice

**Acceptance criteria**
- Add `EULER_API_KEY` server config only.
- Add trusted-origin `POST /api/tiktok/start` and `/api/tiktok/stop`.
- Snapshot exposes configured/active/connecting creator state, never secret.
- UI has TikTok creator field, start/stop controls, safe status rendering, and source-aware recent comments.
- Existing Facebook discovery/multi-live UI remains functional.

**Verification**
- Boundary/source tests prove route/UI wiring and no `innerHTML`.
- `node --check web/app.js` passes.

**Dependencies:** Tasks 1–3

## Task 5 — Full verify + self-review + runtime gate

**Acceptance criteria**
- `npm ci`, typecheck, all tests, build pass on Ubuntu + Windows.
- Review correctness → security → architecture → simplicity → performance.
- No Critical/Required findings remain.
- Real TikTok LIVE with actual Euler key proves connect, comment, TTS, stop isolation, and zero key leak.

**Verification**
```bash
npm ci
npm run typecheck
npm test
npm run build
```

Keep PR #8 Draft until runtime evidence is recorded in `tasks/capture-findings.md`.