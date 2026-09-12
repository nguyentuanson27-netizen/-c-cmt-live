# Plan — TikTok LIVE Ingestion

## Task 1 — Approve ingestion source and MVP contract

**Description:** Lock the external transport before production code. Current TikTok public developer docs do not expose a documented real-time LIVE-comment API, so the implementation source is a product/security decision rather than an implementation detail.

**Acceptance criteria:**
- [ ] Product owner chooses source A/B/C from `docs/specs/tiktok-live-ingestion.md`.
- [ ] Confirm MVP is one TikTok LIVE session, manual username/URL, shared FIFO/TTS, no gifts/follows/discovery.
- [ ] Confirm TikTok TTS format remains `username: comment` or update spec before coding.
- [ ] If a third-party/API key is approved, credentials remain server-side only.

**Verification:**
- [ ] Spec has no unresolved implementation-changing assumption.

**Dependencies:** None

**Files likely touched:**
- `docs/specs/tiktok-live-ingestion.md`
- `tasks/plan.md`
- `tasks/todo.md`

**Estimated scope:** Small

## Task 2 — TDD the TikTok transport adapter

**Description:** Add the smallest provider-specific server adapter behind a narrow interface. Do not couple provider event envelopes to core queue/TTS code.

**Acceptance criteria:**
- [ ] RED tests cover creator input parsing, connect/stop lifecycle, external event validation, normalized comment output, stale-callback isolation, bounded errors, and credential redaction.
- [ ] Initial-history behavior is baselined/ignored where the chosen transport emits history on connect.
- [ ] Reconnect/backoff is bounded and stoppable.
- [ ] TikTok failure is isolated from Facebook sessions.

**Verification:**
- [ ] Focused tests observed RED before implementation where practical.
- [ ] Focused tests GREEN after implementation.

**Dependencies:** Task 1

**Files likely touched:**
- `src/server/tiktok-*.ts`
- `tests/tiktok-*.test.ts`

**Estimated scope:** Medium

## Task 3 — Integrate with shared queue/TTS and local UI

**Description:** Wire one TikTok session into the existing web runtime without changing Facebook multi-live semantics.

**Acceptance criteria:**
- [ ] Add bounded start/stop request contract for TikTok creator username/URL.
- [ ] Normalize accepted comments to `platform: "tiktok"` and a stable TikTok source ID.
- [ ] Reuse the shared queue, TTS service, SSE and playback-owner bridge.
- [ ] UI can start/stop TikTok and show status/comments safely with `textContent`.
- [ ] TikTok stop removes only waiting TikTok items; active Facebook lives remain untouched.
- [ ] No provider key/session credential enters browser payloads/storage/SSE.

**Verification:**
- [ ] Integration/boundary tests GREEN.
- [ ] `node --check web/app.js` GREEN.
- [ ] Existing Facebook tests remain GREEN.

**Dependencies:** Task 2

**Files likely touched:**
- `src/server/main.ts`
- `src/server/config.ts`
- `web/index.html`
- `web/app.js`
- `tests/web-runtime.test.ts`

**Estimated scope:** Large; split vertically if more than ~5 files must change at once.

## Task 4 — Full verification, self-review, real TikTok gate

**Description:** Prove the selected transport works against a real TikTok LIVE and does not weaken existing security/runtime behavior.

**Acceptance criteria:**
- [ ] `npm ci`, typecheck, full tests and build pass on Ubuntu + Windows.
- [ ] Self-review in order correctness → security → architecture → simplicity → performance has no Required finding.
- [ ] Real TikTok LIVE receives a post-connect marker through the shared queue/TTS.
- [ ] Initial/history comments are not replayed as new speech.
- [ ] Stop TikTok does not affect active Facebook sessions.
- [ ] Browser storage/URLs/API/SSE/server logs contain zero provider-secret occurrences.
- [ ] Runtime evidence recorded in `tasks/capture-findings.md`.

**Verification:**
```bash
npm ci
npm run typecheck
npm test
npm run build
```

**Dependencies:** Task 3

**Files likely touched:**
- `tasks/capture-findings.md`
- `tasks/todo.md`
- `README.md`

**Estimated scope:** Medium

PR #8 remains Draft until Task 1 is explicitly approved and remains merge-blocked until the real TikTok runtime gate passes.
