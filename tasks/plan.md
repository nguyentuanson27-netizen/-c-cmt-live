# Implementation Plan — Live Comment TTS MVP

This plan implements the approved MVP spec in small, verifiable slices. The ordering is risk-first: prove platform capture before building the complete application around it.

## Dependency graph

```text
Task 0 Repo/docs bootstrap
        ↓
Task 1 Electron feasibility harness
        ↓
Task 2 Facebook capture spike
        ↓
Task 3 TikTok capture spike
        ↓
Task 4 Shopee capture spike
        ↓
       GATE: all three capture routes viable
        ↓
Task 5 Core comment pipeline
        ↓
Task 6 TTS + sequential audio queue
        ↓
Task 7 Facebook multi-live manager
        ↓
Task 8 TikTok + Shopee production connectors
        ↓
Task 9 Main UI + local config
        ↓
Task 10 Runtime verification + Windows packaging
```

---

## Task 0: Repository and documentation bootstrap

**Description:** Record the approved contract and make the empty repository understandable before implementation.

**Acceptance criteria:**
- [ ] `README.md` explains purpose, MVP limits, architecture, setup, and current status.
- [x] Approved spec exists at `docs/specs/live-comment-tts-mvp.md`.
- [x] Plan and checklist exist under `tasks/`.

**Verification:**
- [ ] README commands match actual repository scripts after Task 1.
- [ ] Docs do not claim runtime behavior that has not been verified.

**Dependencies:** None

**Files likely touched:**
- `README.md`
- `docs/specs/live-comment-tts-mvp.md`
- `tasks/plan.md`
- `tasks/todo.md`

**Estimated scope:** Medium

---

## Task 1: Build the Electron feasibility harness

**Description:** Create the smallest Electron + TypeScript application needed to open one remote live page with a persistent platform session and safe preload boundary. This is a developer/feasibility harness, not the final UI.

**Acceptance criteria:**
- [ ] App can open a user-supplied Facebook/TikTok/Shopee URL in a source `BrowserWindow`.
- [ ] Source window uses the correct persistent `persist:*` partition, is muted, and has `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
- [ ] Platform hostname is validated before navigation; unexpected popup/new-window requests are denied.

**Verification:**
- [ ] Type check/build command succeeds in an environment with dependencies installed.
- [ ] Manual: open each supported platform login/live page and confirm session reuse on restart.
- [ ] Review source-window security options against current Electron docs.

**Dependencies:** Task 0

**Files likely touched:**
- `package.json`
- `tsconfig.json`
- `src/main.ts`
- `src/security/platform-url.ts`
- `src/windows/source-window.ts`

**Estimated scope:** Medium

---

## Task 2: Facebook real-comment capture spike

**Description:** Inspect a current Facebook Live page at runtime and implement only enough parser/preload logic to capture one new real comment as `{ username, text }`.

**Acceptance criteria:**
- [ ] One real Facebook Live comment reaches Electron with correct username and text.
- [ ] Remote page receives no raw privileged Electron API.
- [ ] Parser logic is isolated under `src/connectors/facebook/`.

**Verification:**
- [ ] Manual runtime evidence on a real Facebook Live.
- [ ] Repeat comment/rerender does not obviously emit uncontrolled duplicates during the spike.

**Dependencies:** Task 1

**Files likely touched:**
- `src/connectors/facebook/preload.ts`
- `src/connectors/facebook/parser.ts`
- `src/main.ts`

**Estimated scope:** Small/Medium

---

## Task 3: TikTok real-comment capture spike

**Description:** Inspect a current TikTok Live page and capture one new real comment as `{ username, text }` using the simplest viable page boundary.

**Acceptance criteria:**
- [ ] One real TikTok Live comment reaches Electron with correct username and text.
- [ ] Capture logic remains isolated under `src/connectors/tiktok/`.
- [ ] No unofficial protocol/WebSocket dependency is added unless DOM capture is proven non-viable first.

**Verification:**
- [ ] Manual runtime evidence on a real TikTok Live.

**Dependencies:** Task 1

**Files likely touched:**
- `src/connectors/tiktok/preload.ts`
- `src/connectors/tiktok/parser.ts`

**Estimated scope:** Small/Medium

---

## Task 4: Shopee real-comment capture spike

**Description:** Inspect a current Shopee Live page and capture one new real comment as `{ username, text }` using the simplest viable page boundary.

**Acceptance criteria:**
- [ ] One real Shopee Live comment reaches Electron with correct username and text.
- [ ] Capture logic remains isolated under `src/connectors/shopee/`.
- [ ] Network/WebSocket or other fallback is considered only if DOM capture is proven non-viable.

**Verification:**
- [ ] Manual runtime evidence on a real Shopee Live.

**Dependencies:** Task 1

**Files likely touched:**
- `src/connectors/shopee/preload.ts`
- `src/connectors/shopee/parser.ts`

**Estimated scope:** Small/Medium

---

## Feasibility checkpoint

Tasks 2–4 are a hard gate.

Do not build the complete queue/TTS/application UI until all three platforms have a viable, observed capture route. If one fails, update this plan with the smallest alternative for that platform before proceeding.

---

## Task 5: Core comment pipeline with tests

**Description:** Implement normalized comment types, filtering, deduplication, bounded FIFO behavior, and stale-comment skipping using tests first.

**Acceptance criteria:**
- [ ] Comment normalization rejects empty username/text and caps text to 250 characters.
- [ ] Queue holds at most 30 waiting comments and drops the oldest waiting item on overflow.
- [ ] Dequeue skips comments older than 30 seconds and dedup prevents recent duplicate delivery.

**Verification:**
- [ ] RED observed for new behavioral tests before implementation where practical.
- [ ] Focused tests pass.
- [ ] Full test suite passes.

**Dependencies:** Tasks 2, 3, 4

**Files likely touched:**
- `src/core/comment.ts`
- `src/core/filter.ts`
- `src/core/dedup.ts`
- `src/core/queue.ts`
- `tests/*.test.ts`

**Estimated scope:** Medium

---

## Task 6: Edge TTS and sequential playback

**Description:** Convert a validated comment to exactly `Tên khách: comment`, synthesize via `msedge-tts`, and play one item at a time through the local app renderer.

**Acceptance criteria:**
- [ ] Spoken text contains username + comment only; no platform/Page prefix.
- [ ] Queue advances only after current audio ends/fails.
- [ ] One failure retries once, then skips without blocking later comments.

**Verification:**
- [ ] TTS-format tests pass.
- [ ] Manual: test Vietnamese voice playback and two queued comments without overlap.

**Dependencies:** Task 5

**Files likely touched:**
- `src/core/tts.ts`
- `src/core/queue.ts`
- `src/ui/preload.ts`
- `src/ui/renderer.ts`
- `tests/tts-format.test.ts`

**Estimated scope:** Medium

---

## Task 7: Facebook multi-live manager

**Description:** Extend the proven Facebook source from one live to 1–9 source windows sharing one `persist:facebook` session and one comment queue.

**Acceptance criteria:**
- [ ] 1–9 Facebook live sources can be started/stopped independently.
- [ ] One source failure does not stop other active sources.
- [ ] All accepted comments merge into the same FIFO queue while retaining source label for UI/debug only.

**Verification:**
- [ ] Manual: 2 concurrent lives first, then test up to 9 on the target Windows machine.
- [ ] Observe CPU/RAM before making any performance optimization.

**Dependencies:** Tasks 5, 6

**Files likely touched:**
- `src/connectors/facebook/manager.ts`
- `src/windows/source-window.ts`
- `src/main.ts`
- relevant tests

**Estimated scope:** Medium

---

## Task 8: Finalize TikTok and Shopee connectors

**Description:** Connect the proven spike implementations to the common comment pipeline and single-live lifecycle.

**Acceptance criteria:**
- [ ] TikTok mode supports one live/session and feeds the global queue.
- [ ] Shopee mode supports one live/session and feeds the global queue.
- [ ] Switching mode stops previous platform sources and clears waiting queue items.

**Verification:**
- [ ] Manual runtime test on one TikTok Live.
- [ ] Manual runtime test on one Shopee Live.

**Dependencies:** Tasks 5, 6

**Files likely touched:**
- `src/connectors/tiktok/*`
- `src/connectors/shopee/*`
- `src/main.ts`

**Estimated scope:** Medium

---

## Task 9: Minimal main UI and local config

**Description:** Add the small operator UI described in the spec and persist non-sensitive settings/URLs in Electron `userData` JSON.

**Acceptance criteria:**
- [ ] Platform selector, source URL controls, TTS controls, queue status, and recent comments work.
- [ ] Facebook supports up to 9 URL rows; TikTok/Shopee one URL each.
- [ ] Config stores URLs/settings only and does not store passwords/tokens/cookie dumps.

**Verification:**
- [ ] Keyboard-accessible native controls are usable.
- [ ] Restart app and confirm non-sensitive config persists.

**Dependencies:** Tasks 7, 8

**Files likely touched:**
- `public/index.html`
- `public/app.css`
- `src/ui/renderer.ts`
- `src/core/config.ts`

**Estimated scope:** Medium

---

## Task 10: Final verification and Windows packaging

**Description:** Run repository checks, verify the real runtime acceptance criteria, then select the simplest Windows packaging tool needed for internal distribution.

**Acceptance criteria:**
- [ ] Tests/typecheck/build pass.
- [ ] Facebook/TikTok/Shopee runtime acceptance criteria pass on Windows.
- [ ] A repeatable Windows package/install command is documented.

**Verification:**
- [ ] Full Definition of Done reviewed.
- [ ] Security review for remote BrowserWindows and IPC completed.
- [ ] README reflects actual commands and known platform limitations.

**Dependencies:** Tasks 7, 8, 9

**Files likely touched:**
- packaging config chosen at this task
- `README.md`
- possibly `package.json`

**Estimated scope:** Medium

## Current execution boundary

The repository can be bootstrapped and Task 1 can be implemented from this environment. Tasks 2–4 require manual runtime access to authenticated/current livestream pages. Until that evidence exists, later tasks remain intentionally blocked by the approved feasibility gate.
