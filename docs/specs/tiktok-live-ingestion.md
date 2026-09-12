# Spec — TikTok LIVE Ingestion

## Objective

Add TikTok LIVE comment ingestion to the existing local Node.js/web operator runtime without reintroducing Electron or browser DOM capture. TikTok comments should normalize into the existing `Comment` model and share the current bounded FIFO/TTS/playback pipeline with Facebook.

This PR must not silently depend on an undocumented TikTok transport. The ingestion source is an explicit architecture/security decision because TikTok's public developer products currently do not expose a documented real-time LIVE-comment API.

## Assumptions pending confirmation

1. PR #8 MVP supports **one TikTok LIVE session at a time**. Facebook's existing 2–9 session behavior remains unchanged.
2. Operator starts TikTok manually with a creator `@username` or TikTok LIVE URL; no TikTok live discovery in this PR.
3. TikTok comments use the existing non-Facebook TTS format: `username: comment`.
4. TikTok comments share the existing bounded FIFO, TTS service, SSE playback-owner browser, pause/resume controls, and recent-comment UI.
5. Gifts, follows, likes, viewer counts, moderation, chat sending, TikTok login/session cookies, and Shopee remain out of scope.

## Source research — 2026-09-12

### Official TikTok developer surface

Reviewed current TikTok for Developers documentation:

- Product catalog: https://developers.tiktok.com/docs/en/welcome
- Scope reference: https://developers.tiktok.com/docs/en/tiktok-api-scopes
- Research video comments: https://developers.tiktok.com/docs/en/research-api-specs-query-video-comments
- Research API FAQ: https://developers.tiktok.com/docs/en/research-api-faq

Findings:

- The public product/scope catalog does not expose a LIVE-comment streaming scope/API.
- The documented comment API is Research API `POST /v2/research/video/comment/list/`, which is for video comments, requires approved research access, and is not a real-time TikTok LIVE chat stream.
- Research API data is not suitable as a low-latency live-comment transport.

Therefore an official first-party real-time TikTok LIVE comment source was **not found** in the current public TikTok developer docs.

### Unofficial direct connector candidate

`tiktok-live-connector` 2.4.4 is a current Node.js package that consumes TikTok's internal Webcast transport.

Important constraints from its current package/docs:

- explicitly unofficial / reverse-engineered;
- package license is `AGPL-3.0-only`;
- current package is ESM-only;
- uses Euler Stream for WebSocket signing/provider routes;
- default room-ID resolution can fall back to scraping TikTok HTML;
- authenticated modes can forward TikTok session credentials to a third-party sign service;
- upstream README itself says it is not a production-ready API.

Directly adopting this dependency would therefore introduce license, supply-chain, scraping-policy, vendor, and protocol-breakage concerns. It is **not approved by this spec by default**.

### Managed WebSocket provider candidate

Euler Stream publishes a TikTok LIVE WebSocket API (`wss://ws.eulerstream.com`) that streams live events by creator `uniqueId` using an API key. Their current public pricing includes a free/community tier and cloud WebSocket allowance.

This path avoids embedding the AGPL connector and avoids our application doing TikTok HTML/DOM scraping, but introduces a third-party service/API key and vendor dependency. It is also not a TikTok first-party API.

## Decision gate

Before production connector code is written, the product owner must choose one of:

- **A — Managed provider:** use Euler Stream WebSocket API server-side. Recommended for the current architecture because it avoids DOM/HTML scraping in this repository and avoids the AGPL connector dependency, while keeping the provider API key server-side.
- **B — Unofficial direct connector:** use `tiktok-live-connector` despite the constraints above. Requires explicit acceptance of AGPL/reverse-engineered transport and a design that disables authenticated-session forwarding and avoids scrape fallbacks where possible.
- **C — Official-only:** do not implement realtime TikTok ingestion until TikTok exposes/approves a suitable first-party API for this use case.

No implementation may pretend Research API video comments are TikTok LIVE chat.

## Tech Stack

- Node.js 24 in CI/runtime
- TypeScript 7
- local HTTP/SSE web app
- existing `CommentQueue`, `TTSService`, `PlaybackManager`, and browser playback bridge
- no new frontend framework
- ingestion transport: **pending decision gate**

## Commands

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

## Project Structure

Expected ownership after source selection:

```text
src/server/tiktok-*.ts       TikTok transport/session adapter and normalization
src/server/main.ts           HTTP/SSE orchestration only
tests/tiktok-*.test.ts       transport-adapter and normalization tests
web/index.html               operator controls
web/app.js                   start/stop/status UI using textContent only
docs/specs/                  source-of-truth contract
tasks/                       plan / execution state / runtime evidence
```

## Code Style

Keep provider-specific policy behind a narrow adapter and emit normalized comments into the existing core pipeline.

```ts
export type TikTokLiveComment = {
  id: string;
  username: string;
  text: string;
  timestamp: number;
};
```

`src/server/main.ts` should not decode provider-specific event envelopes directly.

## Testing Strategy

- RED → GREEN unit tests for creator-input parsing, provider event validation, comment normalization, dedup/source identity, connect/stop lifecycle, stale-event isolation, and sanitized errors.
- Boundary tests for HTTP routes/UI wiring and safe rendering.
- Existing Facebook multi-live, queue, TTS, playback and security tests remain green.
- Full Ubuntu + Windows CI must pass.
- Real TikTok LIVE runtime verification is a merge gate for the chosen transport.

## Security / trust boundaries

Assets:
- provider API keys or other server credentials;
- TikTok comment/user data;
- local playback/control authority;
- availability of the shared TTS queue.

Always:
- keep provider credentials server-side;
- bound/validate every external event before enqueue/SSE;
- use fixed provider/TikTok hosts rather than user-controlled server fetch URLs;
- render external strings with `textContent` only;
- cap reconnect/backoff/resource use;
- make stop invalidate stale callbacks;
- keep TikTok failure isolated from active Facebook sessions.

Ask first:
- adding TikTok session cookies/OAuth tokens;
- forwarding credentials to a third party;
- adding an AGPL dependency;
- public/LAN hosting;
- auto-connect/discovery;
- multiple simultaneous TikTok sessions.

Never:
- browser DOM scraping;
- Electron reintroduction;
- client-side provider secrets;
- logging credentials/session cookies;
- unbounded reconnect loops or event buffers;
- treating third-party/unofficial output as trusted.

## Success Criteria

After the source decision is approved:

1. Operator can start one TikTok LIVE by creator username/URL and stop it independently of Facebook sessions.
2. Existing comments present before connection are not replayed as new speech when the selected transport exposes initial history.
3. New TikTok chat comments normalize to `platform: "tiktok"` with stable source identity and enter the shared bounded FIFO.
4. TikTok TTS reads `username: comment` unless the product decision changes this assumption before implementation.
5. Duplicate/stale provider events cannot create repeated speech beyond the existing dedup contract.
6. Disconnect/reconnect failures do not stop Facebook sessions or corrupt the shared queue.
7. Provider errors are bounded/sanitized and contain no credentials.
8. Browser/SSE/storage/logs contain zero provider-secret occurrences.
9. Automated tests, typecheck and build pass on Ubuntu + Windows.
10. Real TikTok LIVE runtime evidence proves comment ingestion, stop isolation, TTS, and secret-leak checks for the chosen transport before merge-ready status.

## Open Questions

- Which source option (A/B/C) is approved?
- Confirm MVP assumptions 1–5 above, especially one TikTok session and `username: comment` TTS.
