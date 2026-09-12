# Live Comment TTS

Local web operator app that reads **managed Facebook Page Live comments** with Vietnamese Edge TTS.

The repository has one active runtime: **Facebook Graph API + local Node.js web server**. The legacy Electron/browser-DOM capture implementation has been removed; git history and ADR 0001 retain the historical rationale.

## Current architecture

```text
Facebook Graph API
      ↓ server-side Page Access Token
2–9 independent FacebookGraphCommentPoller sessions
      ↓ source identity = facebook-graph:<liveVideoId>
normalize → per-live dedup → one bounded FIFO queue
      ↓
msedge-tts (comment content only for FB-API)
      ↓
SSE audio event to one playback-owner browser
      ↓ Web Audio completion POST
server advances shared queue
```

The server binds to `127.0.0.1` by default. It intentionally refuses non-loopback hosts because public hosting requires a separate authentication/authorization design.

## Security boundary

`FACEBOOK_PAGE_ACCESS_TOKEN` is a bearer secret and must stay server-side.

The browser:
- never asks for the Page token;
- never stores it in localStorage/sessionStorage;
- never receives it through API/SSE responses;
- sends only Facebook Live Video IDs/URLs and playback/control commands.

Graph requests send the token in the `Authorization: Bearer ...` header, not the URL/query string.

## Required server environment

Set these before `npm run dev`:

```text
FACEBOOK_PAGE_ACCESS_TOKEN=<Page Access Token>
FACEBOOK_GRAPH_API_VERSION=<explicit Meta Graph version, e.g. vXX.X after verifying your app/dashboard>
```

No Graph version is guessed in code because Meta version support changes over time. Verify the version available to the actual Meta app before runtime testing.

Optional:

```text
HOST=127.0.0.1
PORT=3000
```

Only loopback hosts are accepted by the current runtime.

### PowerShell example

```powershell
$env:FACEBOOK_PAGE_ACCESS_TOKEN="<secret>"
$env:FACEBOOK_GRAPH_API_VERSION="vXX.X"
npm run dev
```

Then open `http://127.0.0.1:3000`.

## Commands

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

CI uses Node.js 24 and runs install + typecheck + tests + build on Ubuntu and Windows. The build syntax-checks the plain browser runtime with `node --check web/app.js`.

## Facebook multi-live behavior

The web runtime supports up to **9 active or connecting Facebook Lives**:
- add Live Video IDs or Facebook video URLs without replacing existing sessions;
- reject duplicate sessions and a 10th active/pending session without disturbing current lives;
- baseline each live independently and emit only post-connect comments;
- keep source identity distinct per live so comments do not cross-deduplicate;
- route all accepted comments into one bounded FIFO/TTS queue;
- synthesize **comment content only** for the `FB-API` source;
- stop one live while keeping the others active; waiting queue items from only that live are removed;
- repeated stop-one is a successful no-op;
- stop all lives and clear the shared waiting queue;
- show active live IDs, source live on recent comments, queue state and observed Graph→app latency;
- keep single-browser playback ownership with handover after the playback-owner tab disconnects.

A comment already being synthesized or played may finish when its individual live is stopped. Waiting comments from that source are removed.

## Verified runtime baseline

The merged multi-live implementation was verified with two real Facebook Lives feeding the same sequential TTS queue. Evidence includes independent baselines, comments from both lives, cross-live dedup isolation, stop-one isolation, playback-owner handover, observed latency and a browser/server secret-leak check.

The detailed record is in `tasks/capture-findings.md`. Future changes to Graph ingestion, concurrency, queueing, playback ownership or token handling should re-run the relevant runtime gate instead of relying only on unit tests.

## Deferred

- more than 9 concurrent Facebook Lives
- auto-discovery of Page live videos
- per-live voices/queues
- public deployment/authentication/webhooks
- TikTok/Shopee web ingestion strategy

## Docs

- `docs/specs/facebook-graph-web-mvp.md` — single-live Graph foundation
- `docs/specs/facebook-graph-multi-live.md` — current 2→9 live contract
- `docs/specs/remove-legacy-electron.md` — focused Electron-removal contract
- `docs/adr/0001-electron-local-browser-capture.md` — superseded historical decision
- `docs/adr/0002-web-graph-api-runtime.md` — current architecture decision
- `tasks/plan.md` — current implementation plan
- `tasks/todo.md` — current execution status
- `tasks/capture-findings.md` — runtime evidence
