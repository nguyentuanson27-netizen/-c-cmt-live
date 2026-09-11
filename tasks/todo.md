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
- [x] Record 2026-09-10 scope amendment: Shopee deferred without blocking Facebook/TikTok core/TTS

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
- [x] Run Electron GUI and confirm source/session behavior during capture verification

## Phase 2 — Capture gate

Follow `docs/runbooks/feasibility-harness.md` and record evidence in `tasks/capture-findings.md`.

- [x] Facebook: capture real live comments (`username`, `text`)
- [x] TikTok: capture real live comments (`username`, `text`)
- [ ] Shopee: capture one real live comment (`username`, `text`) — deferred by product owner decision
- [x] Record observed capture strategy/selectors/network boundary for Facebook and TikTok
- [x] Mark current feasibility decision `GO` for Facebook/TikTok core/TTS work

> Current gate passed for Facebook & TikTok. Shopee remains required before Shopee final integration and full three-platform completion.

## Phase 3 — Core pipeline

- [x] Tests first: normalization/filtering
- [x] Tests first: dedup
- [x] Tests first: FIFO max 30 + oldest-drop
- [x] Tests first: stale >30s skip
- [x] Implement core comment pipeline
- [x] Baseline already-present connector DOM comments instead of emitting them as new

## Phase 4 — TTS

- [x] Test exact `Tên khách: comment` formatting
- [x] Integrate `msedge-tts`
- [x] Escape XML-sensitive untrusted text before SSML embedding
- [x] Sequential audio playback
- [x] Retry once then skip failure
- [x] Validate playback-completion IPC sender/id/payload

## Phase 5 — Platform integration

- [ ] Facebook 1–9 concurrent live manager
- [ ] One TikTok live lifecycle finalization
- [ ] One Shopee live lifecycle after deferred capture resumes
- [ ] Platform mode switching stops previous mode and clears waiting queue

## Phase 6 — UI/config

- [ ] Facebook URL rows up to 9
- [ ] TikTok/Shopee single URL controls for completed platform integrations
- [x] TTS controls/status
- [x] Recent comment view
- [x] Recent comment UI consumes structured comment payloads and preserves usernames containing `:`
- [ ] Local JSON config for non-sensitive settings only

## Phase 7 — Verify/ship

- [x] Current fixed head CI passes tests/typecheck/build
- [x] Runtime-check startup baseline on current Facebook/TikTok pages
- [x] Runtime-check sequential TTS playback on fixed head
- [ ] Facebook runtime 1 → 2 → up to 9 lives
- [ ] TikTok final end-to-end runtime
- [ ] Shopee capture + final runtime
- [ ] Background/minimized source check
- [x] Final security review for the current PR scope
- [ ] Windows packaging choice + repeatable command
- [ ] README/spec/plan/todo final truth check

> The operator reconfirmed before merge that the startup-baseline and sequential-TTS runtime checks above had already been completed. Remaining unchecked items are later-phase MVP work, not blockers for this PR's Facebook/TikTok core + TTS slice.
