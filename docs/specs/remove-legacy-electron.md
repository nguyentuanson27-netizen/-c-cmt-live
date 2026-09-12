# Spec — Remove legacy Electron capture runtime

## Objective

Remove the obsolete Electron/browser-DOM feasibility runtime now that the Facebook Graph web runtime is proven and merged. The repository should have one active runtime: the local Node.js web server in `src/server/main.ts` with the `web/` operator UI.

This cleanup also removes Electron-only TikTok/Shopee DOM preloads. They have no active production/web ingestion path and keeping them would retain the Electron dependency or dead code. Future TikTok/Shopee ingestion is a separate product decision.

## Tech stack

- Node.js 24 + TypeScript
- Built-in `node:http` server
- Vitest
- `msedge-tts`
- No Electron dependency after this PR

## Commands

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

## Project structure

Keep:
- `src/server/` — active Facebook Graph web runtime
- `src/core/` — shared comment/queue/filter primitives used by web runtime
- `src/tts/` — shared TTS/playback logic used by web runtime
- `web/` — active browser operator UI

Remove:
- Electron entrypoint/UI/window/IPC code
- Electron DOM connector preloads for Facebook/TikTok/Shopee
- Electron-only public assets/tests/security helpers
- obsolete Electron feasibility runbook/spec instructions

## Code style

Removal should simplify rather than replace the old harness with abstractions. Do not change active Graph behavior while deleting legacy code.

## Testing strategy

- Add a repository-structure regression guard that fails while Electron dependency/runtime artifacts remain.
- Keep all active Graph web/core/TTS tests green.
- Build must compile only the active web/server source tree and continue checking `web/app.js` plus runtime-module boundaries.
- CI must pass on Ubuntu and Windows without downloading Electron.

## Boundaries

### Always
- Preserve Graph multi-live behavior and server-side token boundary.
- Keep TTS comment-content-only behavior for Facebook Graph.
- Keep future TikTok/Shopee ingestion explicitly deferred rather than pretending it is implemented.

### Ask first
- Change Facebook Graph API behavior.
- Add dependencies.
- Add public hosting/authentication/webhooks.

### Never
- Reintroduce Facebook DOM scraping.
- Keep dead Electron code merely for rollback; git history is the rollback source.
- Remove shared core/TTS code that the web runtime still uses.

## Success criteria

1. `electron` is absent from `package.json` and `package-lock.json`.
2. `npm test` no longer has an Electron pretest/download step.
3. Electron entrypoint, BrowserWindow/preload/IPC source, DOM connector preloads and Electron-only assets/tests are removed.
4. Active Graph web runtime source/tests remain unchanged in behavior and pass.
5. README/AGENTS/ADR/docs describe the web runtime as the sole active runtime and historical Electron ADR as superseded.
6. CI passes on Ubuntu and Windows without installing/downloading Electron.

## Open questions

None blocking. TikTok/Shopee web ingestion remains deferred.
