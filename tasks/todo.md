# MVP Todo

## Phase 0 — Repo/docs

- [x] Initialize repository
- [x] Save approved MVP spec
- [x] Save implementation plan
- [x] Replace bootstrap README with full project README
- [x] Add `AGENTS.md` with agent scope/gate/security rules
- [x] Record Electron/browser-capture architecture decision
- [x] Add GUI/login feasibility runbook
- [x] Add runtime capture findings template
- [x] Link the documentation set from README

## Phase 1 — Feasibility harness

- [x] Add `package.json` and TypeScript config
- [x] Add Electron main window
- [x] Add platform URL validation
- [x] Add secure/muted source BrowserWindow helper
- [x] Add persistent platform partitions
- [x] Add minimal local operator UI for opening a source URL
- [x] Add URL allowlist/source-window tests
- [x] Commit `package-lock.json`
- [x] Add CI with repeatable `npm ci` + typecheck + tests + build
- [x] CI passes `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` on Windows and Ubuntu (Node 24)
- [x] Run Electron GUI and confirm source/session behavior

## Phase 2 — Capture gate

Follow `docs/runbooks/feasibility-harness.md` and record evidence in `tasks/capture-findings.md`.

- [x] Facebook: capture one real live comment (`username`, `text`)
- [x] TikTok: capture one real live comment (`username`, `text`)
- [ ] Shopee: capture one real live comment (`username`, `text`) (Deferred by product owner decision)
- [x] Record observed capture strategy/selectors/network boundary for each platform
- [x] Mark feasibility decision `GO` (Facebook & TikTok unblocked, Shopee deferred)

> Feasibility gate passed for Facebook & TikTok. Core pipeline/TTS unblocked.

## Phase 3 — Core pipeline

- [x] Tests first: normalization/filtering
- [x] Tests first: dedup
- [x] Tests first: FIFO max 30 + oldest-drop
- [x] Tests first: stale >30s skip
- [x] Implement core comment pipeline

## Phase 4 — TTS

- [x] Test exact `Tên khách: comment` formatting
- [x] Integrate `msedge-tts`
- [x] Sequential audio playback
- [x] Retry once then skip failure

## Phase 5 — Platform integration

- [ ] Facebook 1–9 concurrent live manager
- [ ] One TikTok live lifecycle
- [ ] One Shopee live lifecycle
- [ ] Platform mode switching stops previous mode and clears waiting queue

## Phase 6 — UI/config

- [ ] Facebook URL rows up to 9
- [ ] TikTok/Shopee single URL controls
- [ ] TTS controls/status
- [ ] Recent comment view
- [ ] Local JSON config for non-sensitive settings only

## Phase 7 — Verify/ship

- [ ] Full tests for implemented MVP behavior
- [ ] Typecheck
- [ ] Build
- [ ] Facebook runtime 1 → 2 → up to 9 lives
- [ ] TikTok runtime
- [ ] Shopee runtime
- [ ] Background/minimized source check
- [ ] Security review
- [ ] Windows packaging choice + repeatable command
- [ ] README final truth check
