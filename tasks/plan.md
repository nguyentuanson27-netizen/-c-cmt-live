# Plan — Remove legacy Electron runtime

## Task 1 — Lock removal contract

**Acceptance criteria**
- Spec records Electron removal scope and deferred TikTok/Shopee web ingestion.
- Add RED repository-structure test proving Electron dependency/runtime artifacts still exist before cleanup.

**Verification**
- Focused test fails for the expected legacy-artifact assertions only.

## Task 2 — Remove Electron dependency and runtime artifacts

**Acceptance criteria**
- Remove Electron entrypoint, BrowserWindow/source-window/UI preload/renderer, IPC/platform URL helpers, platform selector, DOM preloads and Electron-only public assets.
- Remove Electron-only tests.
- Remove `pretest` Electron require and Electron dev dependency.
- Regenerate/prune lockfile without Electron packages.

**Verification**
- Repository-structure guard GREEN.
- `npm ci` completes without Electron download.

## Task 3 — Align docs/source of truth

**Acceptance criteria**
- `README.md` no longer says legacy Electron remains.
- `AGENTS.md` describes current Graph web runtime and current commands/security boundaries.
- ADR 0001 is explicitly superseded; ADR 0002 is accepted/current and no longer says cleanup is pending.
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
