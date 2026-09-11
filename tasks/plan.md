# Implementation Plan — Live Comment TTS MVP

This plan implements the approved MVP spec in small, verifiable slices. Ordering is **risk-first**: prove current platform capture before building shared behavior around it.

## Source documents

- `docs/specs/live-comment-tts-mvp.md` — approved contract and current scope amendment
- `docs/adr/0001-electron-local-browser-capture.md` — architecture rationale
- `docs/runbooks/feasibility-harness.md` — manual GUI/login capture procedure
- `tasks/capture-findings.md` — runtime evidence record
- `tasks/todo.md` — execution checklist
- `AGENTS.md` — agent rules and gates

## Dependency graph

```text
Task 0 Docs/bootstrap
        ↓
Task 1 Electron feasibility harness
        ↓
Task 2 Facebook capture spike ─┐
Task 3 TikTok capture spike ───┴─→ CURRENT GATE: Facebook + TikTok PASS
                                  ↓
                           Task 5 Core pipeline
                                  ↓
                           Task 6 TTS/playback
                                  ↓
                           Task 7 Facebook multi-live

Task 4 Shopee capture spike (DEFERRED)
        ↓
Shopee portion of Task 8 + full three-platform completion

Task 8 Platform final integration
        ↓
Task 9 Minimal operator UI + config
        ↓
Task 10 Windows verification + packaging
```

Facebook and TikTok may proceed through shared core/TTS and Facebook multi-live once both capture spikes have runtime evidence. Shopee is deferred and does not block those tasks, but Shopee capture remains a prerequisite for Shopee final integration and the full three-platform MVP.

---

## Task 0 — Repository documentation bootstrap

**Description:** Make the project understandable and preserve the approved contract, architecture, execution order, runtime procedure, and agent constraints.

**Acceptance criteria:**
- [x] README explains purpose, status, setup, architecture, scope and links deeper docs.
- [x] Approved spec, implementation plan and todo exist.
- [x] `AGENTS.md`, architecture ADR, feasibility runbook and capture-evidence template exist.

**Verification:**
- [x] README distinguishes implemented, verified, deferred, and pending behavior.
- [x] Runtime gates and sensitive-data rules are documented.
- [x] Docs remain aligned with the current approved scope amendment.

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
- [x] `package-lock.json` exists and CI completes `npm ci` on Windows and Ubuntu with Node 24.
- [x] CI completes `npm run typecheck`, `npm test`, and `npm run build` successfully on Windows and Ubuntu.
- [x] Windows GUI runtime confirmed source open/login/session reuse behavior during capture work.

**Dependencies:** Task 0

**Files:** `package.json`, `tsconfig.json`, `src/main.ts`, `src/windows/source-window.ts`, `src/security/platform-url.ts`, minimal UI/tests

**Scope:** Medium

---

## Task 2 — Facebook real-comment capture spike

**Description:** On a current real Facebook Live page, identify the simplest capture boundary and implement only enough connector logic to emit real new `{ username, text }` comments.

**Acceptance criteria:**
- [x] Exact test-marker text and correct viewer username reach Electron.
- [x] Capture code stays under `src/connectors/facebook/` except minimal shared boundaries.
- [x] No guessed/stale selector is treated as evidence.

**Verification:**
- [x] Follow `docs/runbooks/feasibility-harness.md`.
- [x] Repeat with multiple unique markers.
- [x] Record PASS evidence and capture route in `tasks/capture-findings.md`.

**Dependencies:** Task 1 runnable on Windows GUI

**Files likely touched:** `src/connectors/facebook/*`, minimal IPC validation, focused tests

**Scope:** Small/Medium

---

## Task 3 — TikTok real-comment capture spike

**Description:** On a current real TikTok LIVE, capture new comments through the simplest viable current-page boundary.

**Acceptance criteria:**
- [x] Exact comment text and correct viewer username reach Electron.
- [x] Logic stays under `src/connectors/tiktok/` except minimal shared boundaries.
- [x] Network/WebSocket/unofficial connector is considered only if DOM capture is actually non-viable.

**Verification:**
- [x] Follow the runbook and confirm repeatable real comments.
- [x] Record PASS evidence and capture route in `tasks/capture-findings.md`.

**Dependencies:** Task 1 runnable on Windows GUI

**Files likely touched:** `src/connectors/tiktok/*`, minimal IPC validation, focused tests

**Scope:** Small/Medium

---

## Task 4 — Shopee real-comment capture spike — DEFERRED

**Description:** On a current real Shopee Live page, capture one new buyer comment through the simplest viable current-page boundary.

**Current decision:** Deferred by product owner on 2026-09-10. This task does not block Tasks 5–7 or Facebook/TikTok work. It must be completed before Shopee final integration and before the full three-platform MVP is declared complete.

**Acceptance criteria:**
- [ ] Exact marker text and correct buyer username reach Electron.
- [ ] Logic stays under `src/connectors/shopee/`.
- [ ] Network/WebSocket/API fallback is used only after browser DOM capture is shown insufficient.

**Verification:**
- [ ] Follow the runbook and repeat with multiple markers.
- [ ] Record PASS evidence and capture route in `tasks/capture-findings.md`.

**Dependencies:** Task 1 runnable on Windows GUI; Shopee seller/live environment available

**Files likely touched:** `src/connectors/shopee/*`, minimal IPC validation, focused tests

**Scope:** Small/Medium

---

# CURRENT FEASIBILITY GATE

Before Tasks 5–7, `tasks/capture-findings.md` must contain real runtime evidence for:

```text
Facebook  PASS
TikTok    PASS
```

Shopee is currently `DEFERRED`, not a blocker for shared core/TTS or Facebook multi-live. Before the Shopee portion of Task 8 and before full three-platform completion, Shopee must change from `DEFERRED` to `PASS` with real runtime evidence.

If a required platform fails, document the blocker and choose at most 1–2 simplest evidence-based fallback routes before changing architecture.

---

## Task 5 — Core comment pipeline with tests

**Description:** Implement the platform-independent comment contract, normalization/filtering, deduplication, bounded FIFO queue and stale-comment skipping using tests first.

**Acceptance criteria:**
- [x] Empty username/text rejected and TTS text capped at 250 characters.
- [x] Recent duplicate comments are suppressed.
- [x] Queue holds at most 30 waiting comments, drops oldest on overflow, and skips dequeued comments older than 30 seconds.
- [x] Connector startup baselines already-present DOM comments instead of treating them as newly received.

**Verification:**
- [x] Focused regression tests exist for implemented pure behavior.
- [ ] Current head CI must pass `npm test`, `npm run typecheck`, and `npm run build` after every change.

**Dependencies:** Tasks 2 and 3 PASS. Task 4/Shopee is deferred and does not block this task.

**Files likely touched:** `src/core/*`, `src/connectors/*`, focused tests

**Scope:** Medium

---

## Task 6 — Edge TTS + sequential local playback

**Description:** Format accepted comments as exactly `Tên khách: comment`, synthesize via `msedge-tts`, and play one audio item at a time in the local renderer.

**Acceptance criteria:**
- [x] Spoken text contains username + comment only; no platform/Page prefix.
- [x] Untrusted spoken text is XML-escaped before entering the library SSML envelope.
- [x] Queue advances only after current audio ends/fails.
- [x] Playback completion IPC validates the expected renderer, playback id, and boolean result.
- [x] One playback/synthesis failure retries once, then skips without blocking the queue.

**Verification:**
- [x] Formatting, escaping, queue-state, and IPC validation tests exist.
- [ ] Manual Vietnamese playback verifies two queued comments do not overlap on the current fixed head.
- [ ] Current head CI passes all repository checks.

**Dependencies:** Task 5

**Files likely touched:** `src/tts/*`, `src/main.ts`, `src/ui/*`, focused tests

**Scope:** Medium

**Checkpoint:** Verify the TTS path before adding Facebook multi-window complexity.

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

**Description:** Connect the proven single-live platform capture routes to the common pipeline/TTS lifecycle.

**Acceptance criteria:**
- [ ] TikTok mode supports one live/session.
- [ ] Shopee mode supports one live/session after Task 4 is resumed and passes.
- [ ] Switching platform mode stops previous sources and clears waiting queue items.

**Verification:**
- [ ] Real TikTok runtime comment → TTS path passes.
- [ ] Real Shopee runtime comment → TTS path passes after Shopee capture is proven.
- [ ] Repository checks pass.

**Dependencies:** Tasks 5 and 6; TikTok spike proven. The Shopee portion additionally depends on Task 4 PASS.

**Files likely touched:** `src/connectors/tiktok/*`, `src/connectors/shopee/*`, main lifecycle

**Scope:** Medium

---

## Task 9 — Minimal operator UI + local config

**Description:** Replace the developer harness UI with the agreed operator controls and persist only non-sensitive URLs/settings in Electron `userData` JSON.

**Acceptance criteria:**
- [ ] Facebook has up to 9 URL rows; TikTok has one URL; Shopee controls may remain deferred until its integration resumes.
- [x] Current TTS controls/status, queue size and recent comments are visible.
- [x] Recent comments consume structured comment fields rather than reparsing status text.
- [ ] Config never stores passwords, token/cookie dumps or auth headers.

**Verification:**
- [ ] Native controls usable by keyboard.
- [ ] Restart app and confirm non-sensitive config persists.
- [ ] Full repository checks pass.

**Dependencies:** Task 7 plus the platform-integration slice being exposed in the UI

**Files likely touched:** `public/index.html`, `public/app.css`, `src/ui/*`, `src/core/config.ts`

**Scope:** Medium

---

## Task 10 — Final Windows verification + packaging

**Description:** Prove the agreed runtime contract on the target Windows environment, then choose the simplest packaging tool required for internal distribution.

**Acceptance criteria:**
- [ ] Tests/typecheck/build pass.
- [ ] Facebook/TikTok/Shopee runtime acceptance criteria pass for the full three-platform MVP.
- [ ] A repeatable Windows package/install command is documented.

**Verification:**
- [ ] Facebook 1 → 2 → up to 9 live runtime evidence.
- [ ] TikTok end-to-end runtime evidence.
- [ ] Shopee end-to-end runtime evidence after Task 4 resumes.
- [ ] Background/minimized source behavior checked; only then consider throttling changes.
- [ ] Security review covers remote BrowserWindows, navigation, IPC, SSML output, and sensitive logging.
- [ ] README and todo reflect current truth.

**Dependencies:** Tasks 7, 8 and 9, including Shopee completion for the full three-platform release

**Files:** packaging config selected at this task, README/package scripts as needed

**Scope:** Medium

---

## Project completion gate

The full three-platform MVP is complete only when task acceptance criteria **and** the project Definition of Done are satisfied. In particular:

- runtime behavior is actually observed where relevant;
- changed behavior has appropriate tests;
- repository checks pass;
- error paths are handled;
- docs describe current truth;
- untrusted remote-page/comment boundaries are reviewed;
- Shopee is no longer deferred and has proven end-to-end behavior;
- no unrelated refactor or speculative infrastructure is introduced.
