# Live Comment TTS

Local web operator app that reads **managed Facebook Page Live comments** with Vietnamese Edge TTS.

The active direction is **Facebook Graph API + Node web server**, not Facebook DOM scraping/Electron. The previous Electron implementation remains in the repository temporarily as historical/rollback code.

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

CI uses Node.js 24 and runs install + typecheck + tests + build on Ubuntu and Windows.

## Facebook multi-live behavior

The web runtime supports up to **9 active or connecting Facebook Lives**:
- add Live Video IDs or Facebook video URLs without replacing existing sessions;
- reject duplicate sessions and a 10th active/pending session without disturbing current lives;
- baseline each live independently and emit only post-connect comments;
- keep source identity distinct per live so comments do not cross-deduplicate;
- route all accepted comments into one bounded FIFO/TTS queue;
- synthesize **comment content only** for the `FB-API` source;
- stop one live while keeping the others active; waiting queue items from only that live are removed;
- stop all lives and clear the shared waiting queue;
- show active live IDs, source live on recent comments, queue state and observed Graph→app latency;
- keep single-browser playback ownership with handover after the playback-owner tab disconnects.

Currently playing audio may finish when an individual live is stopped. This keeps stop-one isolated from unrelated sessions and avoids interrupting another live's shared playback path.

## Runtime merge gate

Automated tests are not enough for multi-live Meta integration. Before the multi-live PR is merge-ready, real runtime evidence must prove:
- two real Facebook Lives are connected at the same time;
- both baseline existing comments independently;
- a marker comment from each live reaches the UI/shared queue/TTS;
- shared TTS remains sequential and speaks exact comment content only;
- stopping Live A leaves Live B active and still receiving comments;
- observed Graph→app latency is recorded for both sources;
- browser storage/network URLs/SSE/log output contain no Page token.

Record evidence in `tasks/capture-findings.md`.

## Deferred

- more than 9 concurrent Facebook Lives
- auto-discovery of Page live videos
- per-live voices/queues
- public deployment/authentication/webhooks
- TikTok/Shopee web ingestion strategy
- removal of legacy Electron Facebook code in a focused cleanup

## Docs

- `docs/specs/facebook-graph-web-mvp.md` — original single-live Graph contract
- `docs/specs/facebook-graph-multi-live.md` — 2→9 live contract
- `docs/adr/0002-web-graph-api-runtime.md` — architecture decision
- `tasks/plan.md` — implementation plan
- `tasks/todo.md` — execution status
- `tasks/capture-findings.md` — runtime evidence
