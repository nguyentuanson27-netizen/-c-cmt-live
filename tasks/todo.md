# MVP Todo

## Phase 0 — Repo/docs

- [x] Initialize repository
- [x] Save approved MVP spec
- [x] Save implementation plan
- [ ] Replace bootstrap README with full project README

## Phase 1 — Feasibility harness

- [ ] Add `package.json` and TypeScript config
- [ ] Add Electron main window
- [ ] Add platform URL validation
- [ ] Add secure/muted source BrowserWindow helper
- [ ] Add persistent platform partitions
- [ ] Add minimal local operator UI for opening a source URL
- [ ] Run typecheck/build in an environment with installed dependencies

## Phase 2 — Capture gate

- [ ] Facebook: capture one real live comment (`username`, `text`)
- [ ] TikTok: capture one real live comment (`username`, `text`)
- [ ] Shopee: capture one real live comment (`username`, `text`)
- [ ] Record observed capture strategy/selectors/network boundary for each platform

> Hard gate: do not proceed to full queue/TTS implementation until all three platforms have a viable runtime capture route.

## Phase 3 — Core pipeline

- [ ] Tests first: normalization/filtering
- [ ] Tests first: dedup
- [ ] Tests first: FIFO max 30 + oldest-drop
- [ ] Tests first: stale >30s skip
- [ ] Implement core comment pipeline

## Phase 4 — TTS

- [ ] Test exact `Tên khách: comment` formatting
- [ ] Integrate `msedge-tts`
- [ ] Sequential audio playback
- [ ] Retry once then skip failure

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

- [ ] Full tests
- [ ] Typecheck
- [ ] Build
- [ ] Facebook runtime 1 → 2 → up to 9 lives
- [ ] TikTok runtime
- [ ] Shopee runtime
- [ ] Background/minimized source check
- [ ] Security review
- [ ] Windows packaging choice + repeatable command
- [ ] README final truth check
