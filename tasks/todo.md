# Todo — Remove legacy Electron runtime

## Define / plan
- [x] Confirm Graph web multi-live replacement is merged and runtime-proven.
- [x] Define removal scope: Electron-only harness code/assets/tests/dependency; TikTok/Shopee web ingestion remains deferred.
- [x] Write cleanup spec and plan.

## TDD removal gate
- [x] Add repository-structure regression test for Electron dependency/runtime artifacts.
- [x] Confirm RED in CI: 75 existing tests passed and only the 2 new removal assertions failed while Electron/pretest/legacy entrypoint still existed.

## Remove legacy runtime
- [x] Remove Electron entrypoint, BrowserWindow/source-window/UI preload/renderer, IPC and platform-URL runtime helpers.
- [x] Keep `src/platform.ts` only as the shared `Platform` type still used by active core code.
- [x] Remove Facebook/TikTok/Shopee Electron DOM preloads.
- [x] Remove Electron-only public assets and tests.
- [x] Remove Electron dev dependency, Electron `pretest`, and obsolete runtime-module guard.
- [x] Regenerate `package-lock.json`; Electron and `@electron` packages are absent.
- [x] Remove the temporary lockfile-regeneration workflow; final workflows contain only read-only CI.

## Docs
- [x] Update README and AGENTS to current web-only runtime truth.
- [x] Mark ADR 0001 superseded and ADR 0002 accepted/current.
- [x] Align single-live/multi-live specs with completed migration/runtime evidence.
- [x] Remove obsolete Electron MVP spec and feasibility runbook.

## Verification
- [x] Removal guard GREEN.
- [x] `npm ci` PASS without Electron download on Ubuntu and Windows; 80 packages installed / 81 audited, 0 vulnerabilities.
- [x] `npm run typecheck` PASS.
- [x] `npm test` PASS: 11 active test files / 50 tests.
- [x] `npm run build` PASS, including `node --check web/app.js`.
- [x] Ubuntu CI PASS on cleanup code head `b7d19b0051e7a09b1406cd27f50e16fe078f1534`.
- [x] Windows CI PASS on cleanup code head `b7d19b0051e7a09b1406cd27f50e16fe078f1534`.
- [x] Self-review: no Required findings across correctness, security, architecture, simplicity or performance.
- [x] Final exact-head CI PASS after the documentation-only closeout commit.

## Runtime note

No new Facebook Live session is required for this cleanup PR because it does not change the active Graph/server/web behavior. The two-live runtime evidence from the merged multi-live implementation remains the behavioral baseline. Any future change to Graph ingestion, concurrency, queueing, playback ownership or token handling must re-run the relevant runtime gate.
