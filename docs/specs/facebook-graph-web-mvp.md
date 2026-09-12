# Spec — Facebook Graph Web Runtime

## Objective

Replace the active Electron/Facebook DOM capture path with a local web application backed by Node.js and Facebook Graph API polling. The first slice targets one managed Facebook Page live session and proves low-latency comment capture into the existing normalize/dedup/queue/TTS pipeline.

## Tech stack

- Node.js 24 + TypeScript
- Built-in `node:http` server (no new web framework dependency)
- Server-Sent Events (SSE) from backend to operator browser
- Existing `msedge-tts`, core comment filter/dedup/queue, and playback manager
- Facebook Graph API with an explicitly configured API version

## Commands

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

`npm run dev` starts the web runtime. The legacy Electron implementation was removed after the Graph replacement and multi-live extension were runtime-proven; ADR 0001 remains only as historical context.

## Project structure

```text
src/server/facebook-graph.ts   # Graph API parsing/polling lifecycle
src/server/events.ts           # SSE broadcaster
src/server/main.ts             # HTTP API + core/TTS orchestration
web/index.html                 # operator UI
web/app.js                     # SSE + controls + audio playback
web/app.css                    # operator styles
tests/facebook-graph-web.test.ts
```

## Code style

Validate every external boundary before state mutation. Prefer explicit state over generic frameworks.

```ts
const liveVideoId = extractFacebookLiveVideoId(input);
if (!liveVideoId) {
  return { ok: false, error: "Invalid Facebook Live video ID or URL" };
}
```

## Testing strategy

- Unit tests for Live Video ID extraction, auth header construction, baseline, pagination and lifecycle races.
- Unit coverage for Graph TTS formatting: `FB-API` speech is exactly the comment content, without username/fallback prefix.
- Regression coverage ensures unattributed Facebook comments are not collapsed by content-based dedup.
- Existing core/TTS tests remain green.
- CI runs typecheck, full tests and build on Ubuntu + Windows.
- Runtime verification with a real managed Page live remains mandatory when Graph ingestion behavior changes.

## Boundaries

### Always
- Page Access Token stays server-side and is never returned to the browser, localStorage, logs or URLs.
- Bind the development server to `127.0.0.1` by default.
- Validate JSON body size/type and Facebook Live identifiers.
- Poll comments with bounded pagination and discard stale async work after stop/restart.
- Scope deduplication by live source; do not collapse distinct unattributed comments merely because their text matches.
- For `FB-API`, synthesize only the normalized comment text. Do not speak viewer username or a fallback identity.

### Ask first
- Public internet deployment or non-loopback binding.
- Adding user authentication, a database or a third-party web framework.
- Webhooks/public HTTPS infrastructure.

### Never
- Scrape Facebook DOM in the active path.
- Put Page Access Tokens in query strings or browser storage.
- Log tokens or Graph API authorization headers.
- Silently pin an unverified/deprecated Graph API version.

## Success criteria

1. Operator opens the local web UI with no Electron window.
2. Browser submits only a Facebook Live ID/URL; Page token and API version come from server environment.
3. Initial comments are baselined and not spoken.
4. New comments are polled with bounded pagination so bursts larger than one page are not silently lost.
5. Stop/restart cannot let an old in-flight poll emit into the new session.
6. Accepted comments flow through normalization, source-scoped dedup, bounded FIFO and sequential Edge TTS.
7. `FB-API` audio contains only comment text, never username or a fallback identity.
8. Audio is played in the browser and completion advances the server-side queue.
9. Typecheck/tests/build pass on Windows and Ubuntu CI.
10. A real Page live runtime check records exact external-viewer comment text and observed comment latency before a Graph-ingestion change is considered merge-ready; viewer username is not required.

## Historical follow-up

The single-live slice was later extended to 2–9 concurrent live sessions under `docs/specs/facebook-graph-multi-live.md` and verified with two real Facebook Lives. The obsolete Electron implementation was then removed in the focused cleanup under `docs/specs/remove-legacy-electron.md`.

## Open questions

The current Meta Graph API version must be supplied explicitly via `FACEBOOK_GRAPH_API_VERSION` and verified against the Meta app/dashboard before runtime verification. Do not guess a version from memory.
