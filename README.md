# Live Comment TTS

Local web operator app that reads **managed Facebook Page Live comments** with Vietnamese Edge TTS.

The active direction is now **Facebook Graph API + Node web server**, not Facebook DOM scraping/Electron. The previous Electron implementation remains in the repository temporarily as historical/rollback code until the Graph runtime passes a real-live verification gate.

## Current architecture

```text
Facebook Graph API
      ↓ server-side Page Access Token
FacebookGraphCommentPoller
      ↓
normalize → dedup (current live scope) → bounded FIFO queue
      ↓
msedge-tts
      ↓
SSE audio event
      ↓
operator browser Web Audio playback
      ↓ completion POST
server advances queue
```

The server binds to `127.0.0.1` by default. It intentionally refuses non-loopback hosts in this slice because public hosting would require a separate authentication/authorization design.

## Security boundary

`FACEBOOK_PAGE_ACCESS_TOKEN` is a bearer secret and must stay server-side.

The browser:
- never asks for the Page token;
- never stores it in localStorage/sessionStorage;
- never receives it through API/SSE responses;
- sends only a Facebook Live Video ID/URL and playback-control commands.

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

## What this PR proves

The first Graph/web slice is deliberately single-live:
- parse numeric Live Video IDs and Facebook video URLs;
- baseline comments already present at connect time;
- poll every ~1s;
- paginate backwards until the previous boundary so a burst larger than one page is not silently lost;
- abort/discard stale in-flight work on stop/restart;
- normalize/filter/dedup/queue comments;
- synthesize exact `username: comment` speech with existing Edge TTS;
- play one audio item at a time in the browser and acknowledge completion to advance the queue;
- show recent comments and observed Graph→app latency.

## Runtime merge gate

Automated tests are not enough for Meta integration. Before this PR is merge-ready, a real managed Facebook Page live must prove:
- existing comments are not spoken after connect;
- a new marker comment returns the expected viewer username + exact text;
- two quick comments play sequentially without overlap;
- observed comment latency is recorded;
- browser storage/network URLs/log output contain no Page token.

Record evidence in `tasks/capture-findings.md`.

## Deferred

- Facebook 2→9 concurrent lives (after this single-live path is proven)
- public deployment/authentication
- Meta webhooks
- TikTok/Shopee web ingestion strategy
- removal of legacy Electron code (focused follow-up after runtime proof)

## Docs

- `docs/specs/facebook-graph-web-mvp.md` — current contract
- `docs/adr/0002-web-graph-api-runtime.md` — architecture decision
- `tasks/plan.md` — implementation plan
- `tasks/todo.md` — execution status
- `tasks/capture-findings.md` — runtime evidence
