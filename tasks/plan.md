# Plan — Remove legacy Electron runtime

## Task 1 — Lock removal contract

**Acceptance criteria**
- Spec records Electron removal scope and deferred TikTok/Shopee web ingestion.
- Add RED repository-structure test proving Electron dependency/runtime artifacts still exist before cleanup.

**Verification**
- Focused test fails for the expected legacy-artifact assertions only.

## Task 2 — Remove Electron dependency and runtime artifacts

**Acceptance criteria**
- Remove Electron entrypoint, BrowserWindow/source-window/UI preload/renderer, IPC/platform-URL helpers and DOM preloads.
- Keep the shared `Platform` domain type used by active core code, but remove its Electron-only runtime helpers.
- Remove Electron-only public assets and tests.
- Remove `pretest`, Electron dev dependency and the Electron-only runtime-module build guard.
- Regenerate/prune the lockfile so Electron packages are absent.

**Verification**
- Repository-structure guard GREEN.
- `npm ci` completes without an Electron download.

## Task 3 — Align docs/source of truth

**Acceptance criteria**
- `README.md` describes the web runtime as the sole active runtime.
- `AGENTS.md` describes current Graph web commands/security boundaries and treats TikTok/Shopee web ingestion as deferred.
- ADR 0001 is explicitly superseded; ADR 0002 is accepted/current.
- Single-live and multi-live specs record their completed migration/runtime gates instead of stale draft/deferred language.
- Remove obsolete Electron feasibility runbook and original Electron MVP spec.

**Verification**
- No active documentation points operators/agents to Electron runtime commands or DOM capture.

## Task 4 — Full verification and review

**Acceptance criteria**
- Active Graph/core/TTS tests pass.
- Typecheck/build pass.
- CI passes Ubuntu + Windows without Electron installation/download.
- Self-review finds no Required correctness/security/architecture issue.

**Verification**
```bash
npm ci
npm run typecheck
npm test
npm run build
```
