# Implementation Plan — Live Comment TTS MVP

This plan implements the approved MVP spec in small, verifiable slices. Ordering is **risk-first**: prove current platform capture before building the complete queue/TTS application around it.

## Source documents

- `docs/specs/live-comment-tts-mvp.md` — approved contract
- `docs/adr/0001-electron-local-browser-capture.md` — architecture rationale
- `docs/runbooks/feasibility-harness.md` — manual GUI/login capture procedure
- `tasks/capture-findings.md` — runtime evidence record
- `tasks/todo.md` — execution checklist
- `AGENTS.md` — agent rules and hard gates

## Dependency graph

```text
Task 0 Docs/bootstrap
        ↓
Task 1 Electron feasibility harness
        ↓
Task 2 Facebook capture spike ─┐
Task 3 TikTok capture spike   ├─→ HARD GATE: all three PASS
Task 4 Shopee capture spike ──┘
        ↓
Task 5 Core comment pipeline
        ↓
Task 6 TTS + sequential playback
        ↓
Task 7 Facebook multi-live
Task 8 TikTok/Shopee final integration
        ↓
Task 9 Minimal operator UI + config
        ↓
Task 10 Windows verification + packaging
```

Tasks 2–4 may be investigated independently once Task 1 is runnable, but the project must not proceed past the hard gate until **all three** have runtime evidence.

---

## Task 0 — Repository documentation bootstrap

**Description:** Make the project understandable and preserve the approved contract, architecture, execution order, runtime procedure, and agent constraints.

**Acceptance criteria:**
- [x] README explains purpose, status, setup, architecture, scope and links deeper docs.
- [x] Approved spec, implementation plan and todo exist.
- [x] `AGENTS.md`, architecture ADR, feasibility runbook and capture-evidence template exist.

**Verification:**
- [x] README clearly distinguishes implemented vs not verified behavior.
- [x] Runtime gate and sensitive-data rules are documented.
- [x] Docs do not claim real platform capture has passed.

**Dependencies:** None

**Files:** `README.md`, `AGENTS.md`, `docs/**`, `tasks/**`

**Scope:** Medium

---

## Task 1 — Electron feasibility harness

**Description:** Provide the smallest Electron + TypeScript app required to open one platform source window with a persistent session and controlled remote-page boundary.

**Acceptance criteria:**
- [x] Source URL is validated for Facebook/TikTok/Shopee.
- [x] Source window uses `persist:<platform>`, is muted, sandboxed, isolated, and has Node integration disabled.
- [x] Operator UI can open/close a source and open DevTools.

**Verification:**
- [ ] `npm install` succeeds and reviewed `package-lock.json` is committed.
- [ ] `npm run typecheck`, `npm test`, `npm run build` pass with repository dependencies installed.
- [ ] Windows GUI runtime confirms source open/login/session reuse behavior.

**Dependencies:** Task 0

**Files:** `package.json`, `tsconfig.json`, `src/main.ts`, `src/windows/source-window.ts`, `src/security/platform-url.ts`, minimal UI/tests

**Scope:** Medium

**Checkpoint:** Do not call Task 1 fully verified until GUI runtime is observed.

---

## Task 2 — Facebook real-comment capture spike

**Description:** On a current real Facebook Live page, identify the simplest capture boundary and implement only enough connector logic to emit one real `{ username, text }` comment.

**Acceptance criteria:**
- [ ] Exact test-marker text and correct viewer username reach Electron.
- [ ] Capture code stays under `src/connectors/facebook/` except the minimal shared IPC boundary.
- [ ] No guessed/stale selector is treated as evidence.

**Verification:**
- [ ] Follow `docs/runbooks/feasibility-harness.md`.
- [ ] Repeat with at least three unique markers.
- [ ] Record PASS evidence and capture route in `tasks/capture-findings.md`.

**Dependencies:** Task 1 runnable on Windows GUI

**Files likely touched:** `src/connectors/facebook/*`, minimal IPC validation, focused test if valuable

**Scope:** Small/Medium

---

## Task 3 — TikTok real-comment capture spike

**Description:** On a current real TikTok LIVE, capture one new comment through the simplest viable current-page boundary.

**Acceptance criteria:**
- [ ] Exact marker text and correct viewer username reach Electron.
- [ ] Logic stays under `src/connectors/tiktok/`.
- [ ] Network/WebSocket/unofficial connector is considered only if DOM capture is actually non-viable.

**Verification:**
- [ ] Follow the runbook and repeat with at least three markers.
- [ ] Record PASS evidence and capture route in `tasks/capture-findings.md`.

**Dependencies:** Task 1 runnable on Windows GUI

**Files likely touched:** `src/connectors/tiktok/*`, minimal IPC validation, focused test if valuable

**Scope:** Small/Medium

---

## Task 4 — Shopee real-comment capture spike

**Description:** On a current real Shopee Live page, capture one new buyer comment through the simplest viable current-page boundary.

**Acceptance criteria:**
- [ ] Exact marker text and correct buyer username reach Electron.
- [ ] Logic stays under `src/connectors/shopee/`.
- [ ] Network/WebSocket/API fallback is used only after browser DOM capture is shown insufficient.

**Verification:**
- [ ] Follow the runbook and repeat with at least three markers.
- [ ] Record PASS evidence and capture route in `tasks/capture-findings.md`.

**Dependencies:** Task 1 runnable on Windows GUI

**Files likely touched:** `src/connectors/shopee/*`, minimal IPC validation, focused test if valuable

**Scope:** Small/Medium

---

# HARD FEASIBILITY GATE

Do not start Tasks 5–10 until `tasks/capture-findings.md` contains real runtime evidence for:

```text
Facebook  PASS
TikTok    PASS
Shopee    PASS
```

If a platform fails, document the blocker and choose at most 1–2 simplest evidence-based fallback routes before changing architecture.

---

## Task 5 — Core comment pipeline with tests

**Description:** Implement the platform-independent comment contract, normalization/filtering, deduplication, bounded FIFO queue and stale-comment skipping using tests first.

**Acceptance criteria:**
- [ ] Empty username/text rejected and TTS text capped at 250 characters.
- [ ] Recent duplicate comments are suppressed.
- [ ] Queue holds at most 30 waiting comments, drops oldest on overflow, and skips dequeued comments older than 30 seconds.

**Verification:**
- [ ] Focused RED→GREEN tests for new behavior where practical.
- [ ] `npm test`, `npm run typecheck`, `npm run build` pass.

**Dependencies:** Tasks 2, 3 and 4 PASS

**Files likely touched:** `src/core/comment.ts`, `filter.ts`, `dedup.ts`, `queue.ts`, focused tests

**Scope:** Medium

---

## Task 6 — Edge TTS + sequential local playback

**Description:** Format accepted comments as exactly `Tên khách: comment`, synthesize via `msedge-tts`, and play one audio item at a time in the local renderer.

**Acceptance criteria:**
- [ ] Spoken text contains username + comment only; no platform/Page prefix.
- [ ] Queue advances only after current audio ends/fails.
- [ ] One playback/synthesis failure retries once, then skips without blocking the queue.

**Verification:**
- [ ] Formatting and queue-state tests pass.
- [ ] Manual Vietnamese playback verifies two queued comments do not overlap.
- [ ] Full repository checks pass.

**Dependencies:** Task 5

**Files likely touched:** `src/core/tts.ts`, queue integration, `src/ui/*`, focused tests

**Scope:** Medium

**Checkpoint:** Verify TTS path before adding Facebook multi-window complexity.

---

## Task 7 — Facebook 1–9 live manager

**Description:** Extend the proven Facebook connector from one source to up to 9 source windows sharing one `persist:facebook` session and one global comment queue.

**Acceptance criteria:**
- [ ] Sources start/stop independently.
- [ ] One source failure does not stop other Facebook sources.
- [ ] Accepted comments merge into one FIFO queue while retaining source label for UI/debug only.

**Verification:**
- [ ] Runtime verify 2 concurrent live pages first.
- [ ] Runtime test progressively up to 9 on the target Windows machine.
- [ ] Observe CPU/RAM before changing performance settings.

**Dependencies:** Tasks 5 and 6, Facebook spike proven

**Files likely touched:** `src/connectors/facebook/manager.ts`, source-window lifecycle, main integration, focused tests

**Scope:** Medium

---

## Task 8 — Final TikTok and Shopee integration

**Description:** Connect the proven single-live TikTok and Shopee capture routes to the common pipeline/TTS lifecycle.

**Acceptance criteria:**
- [ ] TikTok mode supports one live/session.
- [ ] Shopee mode supports one live/session.
- [ ] Switching platform mode stops previous sources and clears waiting queue items.

**Verification:**
- [ ] Real TikTok runtime comment → TTS path passes.
- [ ] Real Shopee runtime comment → TTS path passes.
- [ ] Repository checks pass.

**Dependencies:** Tasks 5 and 6, TikTok/Shopee spikes proven

**Files likely touched:** `src/connectors/tiktok/*`, `src/connectors/shopee/*`, main lifecycle

**Scope:** Medium

---

## Task 9 — Minimal operator UI + local config

**Description:** Replace the developer harness UI with the agreed operator controls and persist only non-sensitive URLs/settings in Electron `userData` JSON.

**Acceptance criteria:**
- [ ] Facebook has up to 9 URL rows; TikTok/Shopee have one URL each.
- [ ] TTS controls/status, queue size and recent comments are visible.
- [ ] Config never stores passwords, token/cookie dumps or auth headers.

**Verification:**
- [ ] Native controls usable by keyboard.
- [ ] Restart app and confirm non-sensitive config persists.
- [ ] Full repository checks pass.

**Dependencies:** Tasks 7 and 8

**Files likely touched:** `public/index.html`, `public/app.css`, `src/ui/*`, `src/core/config.ts`

**Scope:** Medium

---

## Task 10 — Final Windows verification + packaging

**Description:** Prove the agreed runtime contract on the target Windows environment, then choose the simplest packaging tool required for internal distribution.

**Acceptance criteria:**
- [ ] Tests/typecheck/build pass.
- [ ] Facebook/TikTok/Shopee runtime acceptance criteria pass.
- [ ] A repeatable Windows package/install command is documented.

**Verification:**
- [ ] Facebook 1 → 2 → up to 9 live runtime evidence.
- [ ] TikTok and Shopee end-to-end runtime evidence.
- [ ] Background/minimized source behavior checked; only then consider throttling changes.
- [ ] Security review covers remote BrowserWindows, navigation, IPC and sensitive logging.
- [ ] README and todo reflect current truth.

**Dependencies:** Tasks 7, 8 and 9

**Files:** packaging config selected at this task, README/package scripts as needed

**Scope:** Medium

---

## Project completion gate

The MVP is complete only when task acceptance criteria **and** the project Definition of Done are satisfied. In particular:

- runtime behavior is actually observed where relevant;
- changed behavior has appropriate tests;
- repository checks pass;
- error paths are handled;
- docs describe current truth;
- untrusted remote-page/comment boundaries are reviewed;
- no unrelated refactor or speculative infrastructure is introduced.
