# Todo — Remove legacy Electron runtime

## Define / plan
- [x] Confirm Graph web multi-live replacement is merged and runtime-proven.
- [x] Define removal scope: all Electron-only harness code/assets/tests/dependency; TikTok/Shopee web ingestion remains deferred.
- [x] Write cleanup spec and plan.

## TDD removal gate
- [ ] Add RED repository-structure test for Electron dependency/runtime artifacts.
- [ ] Confirm RED fails for expected legacy artifacts.

## Remove legacy runtime
- [ ] Remove Electron entrypoint/UI/window/IPC/platform code.
- [ ] Remove Facebook/TikTok/Shopee Electron DOM preloads.
- [ ] Remove Electron-only public assets and tests.
- [ ] Remove Electron dev dependency and pretest.
- [ ] Prune package-lock Electron packages.

## Docs
- [ ] Update README and AGENTS to current web-only runtime truth.
- [ ] Mark ADR 0001 superseded and ADR 0002 accepted/current.
- [ ] Remove obsolete Electron MVP spec and feasibility runbook.

## Verification
- [ ] Removal guard GREEN.
- [ ] `npm ci` PASS without Electron download.
- [ ] `npm run typecheck` PASS.
- [ ] `npm test` PASS.
- [ ] `npm run build` PASS.
- [ ] Ubuntu CI PASS.
- [ ] Windows CI PASS.
- [ ] Self-review completed with no Required findings.
