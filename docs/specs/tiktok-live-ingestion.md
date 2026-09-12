# Spec — TikTok LIVE Ingestion

## Objective

Add one TikTok LIVE comment session to the existing local Node.js/web operator runtime without reintroducing Electron or browser DOM capture. TikTok comments normalize into the existing `Comment` model and share the current bounded FIFO/TTS/playback pipeline with Facebook.

## Approved source decision

**A — Euler Stream managed WebSocket API** is approved for PR #8.

Current provider contract checked on 2026-09-12:
- connect server-side to fixed host `wss://ws.eulerstream.com`;
- authenticate with `EULER_API_KEY` in the WebSocket query string required by the provider;
- identify the stream with TikTok creator `uniqueId`;
- request decoded bundled events (`features.bundleEvents=true`, `features.rawMessages=false`);
- explicitly pin `schemaVersion=v2` to avoid relying on changing provider defaults;
- common chat events are delivered as `WebcastChatMessage` records inside a message bundle.

Euler's current WebSocket SDK is MIT-licensed and documents v2 as the default schema. PR #8 does not need the SDK at runtime: Node.js 24 has a stable built-in WHATWG `WebSocket`, and the provider's decoded/bundled mode exposes JSON messages. Avoiding an SDK dependency keeps the integration narrow and avoids ESM/CJS churn in the existing CommonJS build.

This remains a third-party provider integration, not a first-party TikTok developer API.

## MVP contract

1. Support **one TikTok LIVE session at a time** while Facebook's existing 2–9 sessions remain unchanged.
2. Operator starts TikTok manually with a creator username, `@username`, or canonical TikTok LIVE URL.
3. TikTok comments use existing non-Facebook TTS behavior: `username: comment`.
4. TikTok comments share the existing bounded FIFO, TTS service, SSE playback-owner browser, pause/resume controls, and recent-comment UI.
5. Gifts, follows, likes, viewer counts, moderation, chat sending, TikTok login/session cookies, discovery, multi-TikTok, and Shopee are out of scope.
6. Stop TikTok independently; waiting TikTok queue items are removed while Facebook sessions stay active.
7. Retry only provider-documented transient closes with bounded exponential backoff; terminal auth/offline/end errors do not loop forever.

## Tech Stack

- Node.js 24 in CI/runtime
- TypeScript 7
- built-in Node.js `WebSocket`
- local HTTP/SSE web app
- existing `CommentQueue`, `TTSService`, `PlaybackManager`, and browser playback bridge
- no new runtime dependency for TikTok ingestion

## Commands

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

## Project Structure

```text
src/server/tiktok-euler.ts             provider transport + lifecycle
src/server/tiktok-comment-processor.ts provider-event normalization/dedup
src/server/config.ts                   TikTok env/input parsing
src/server/main.ts                     HTTP/SSE orchestration only
tests/tiktok-*.test.ts                 transport/parser/lifecycle regressions
web/index.html                         operator controls
web/app.js                             start/stop/status UI via textContent
docs/specs/                            source-of-truth contract
tasks/                                 plan / execution state / runtime evidence
```

Provider-specific envelope decoding must stay out of `src/server/main.ts`.

## API contract

### Server environment

```text
EULER_API_KEY=<Euler Stream API key>
```

The browser must never receive this key.

### `POST /api/tiktok/start`

Request:

```json
{ "creator": "@creator" }
```

Accept username, `@username`, or canonical `https://www.tiktok.com/@username/live` URL. Reject arbitrary hosts/paths and client-supplied credentials.

### `POST /api/tiktok/stop`

Request body is `{}`. Repeated stop is a successful no-op.

### State/SSE

Snapshot/state includes TikTok configured/active/connecting creator state without secrets. TikTok status/comment events are source-labelled and coexist with Facebook events.

## Provider event normalization

Only bounded `WebcastChatMessage` events are eligible for TTS. Treat every provider payload as untrusted.

Normalized provider comment shape:

```ts
export type TikTokEulerComment = {
  id: string;
  username: string;
  text: string;
  timestamp: number;
};
```

Support provider schema variation defensively:
- comment text: `data.comment` or `data.content`;
- username: `data.user.uniqueId`, `data.user.displayId`, then `data.user.nickname`;
- stable message id: provider/common message id when present; otherwise a bounded fallback id.

Drop malformed/non-chat/empty events. Cap a received bundle before iterating it.

## Lifecycle / reconnect policy

- One active or pending TikTok creator only.
- Starting while another TikTok session is active/pending returns conflict and does not affect Facebook.
- Manual stop invalidates stale callbacks and cancels scheduled reconnects.
- Retryable provider closes: internal/upstream/idle/max-lifetime/TikTok-disconnect classes only.
- Terminal closes: normal manual close, stream ended, invalid options/auth/permission, creator offline.
- Maximum 5 reconnect attempts using bounded exponential delay (1s, 2s, 4s, 8s, 16s).
- Never log or surface the provider WebSocket URL because it contains `apiKey`.

## Security / trust boundaries

Assets:
- `EULER_API_KEY` server secret;
- TikTok comment/user data;
- local playback/control authority;
- shared TTS queue availability.

Always:
- keep provider credentials server-side;
- fixed outbound host `ws.eulerstream.com` only;
- validate/bound external event fields before queue/SSE;
- render external strings with `textContent` only;
- redact API key before bounding external error text;
- isolate TikTok failure from Facebook sessions;
- cap reconnects and received bundle size.

Ask first:
- TikTok session cookies/OAuth tokens;
- another third-party credential type;
- public/LAN hosting;
- auto-connect/discovery;
- multiple simultaneous TikTok sessions.

Never:
- DOM/HTML scraping in this app;
- Electron reintroduction;
- client-side provider secrets;
- credential/session logging;
- user-controlled WebSocket host;
- unbounded reconnect/event buffers.

## Testing Strategy

- RED → GREEN unit tests for creator parsing, fixed provider URL/auth, bundle validation, normalization, dedup/source identity, error redaction, connect/stop lifecycle, reconnect cap, and stale-event isolation.
- Boundary tests for HTTP routes/UI wiring and safe rendering.
- Existing Facebook multi-live, queue, TTS, playback, and security tests remain green.
- Full Ubuntu + Windows CI must pass.
- Real TikTok LIVE runtime verification is a merge gate.

## Success Criteria

1. Operator can start one TikTok LIVE by creator username/URL and stop it independently of Facebook sessions.
2. New TikTok chat comments normalize to `platform: "tiktok"`, source `tiktok-euler:<uniqueId>`, and enter the shared bounded FIFO.
3. TikTok TTS reads `username: comment`.
4. Duplicate/stale provider events cannot create repeated speech beyond the existing dedup contract.
5. Transient disconnects retry with the bounded policy; terminal failures stop retrying and do not disturb Facebook.
6. Waiting TikTok comments are removed on TikTok stop; a currently-playing item may finish consistently with Facebook stop semantics.
7. Provider errors are bounded/sanitized and contain no API key.
8. Browser API/SSE/storage and server logs contain zero provider-secret occurrences.
9. Automated tests, typecheck, and build pass on Ubuntu + Windows.
10. Real TikTok LIVE runtime evidence proves connect → new comment → TTS → stop isolation → reconnect/terminal behavior where practical → zero secret leaks before merge-ready.

## Runtime gate

PR #8 remains Draft until a real TikTok LIVE is tested with an actual Euler Stream API key and evidence is recorded in `tasks/capture-findings.md`. CI/mocks do not substitute for this provider integration gate.