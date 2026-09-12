# Spec — Facebook Graph Multi-Live Web Runtime

## Objective

Extend the proven local Facebook Graph web runtime from one managed Facebook Live to **2–9 concurrent Live Video sessions**. Each live is polled independently with the existing Graph connector, while accepted comments share one bounded FIFO/TTS pipeline. For the Facebook Graph source, TTS reads **comment content only**.

## Tech stack

- Node.js 24 + TypeScript
- Built-in `node:http` server
- Existing `FacebookGraphCommentPoller` per active live
- Server-Sent Events (SSE) to the local operator browser
- Existing queue, Edge TTS and browser Web Audio playback
- No new runtime dependency

## Commands

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

## Project structure

```text
src/server/facebook-graph.ts          # one-live Graph polling primitive
src/server/facebook-live-manager.ts   # 2→9 live lifecycle/capacity orchestration
src/server/main.ts                    # HTTP/SSE + shared queue/TTS
src/core/queue.ts                     # bounded FIFO; generic selective removal if needed
web/index.html                        # operator controls + active-live list
web/app.js                            # add/stop individual live sessions
web/app.css                           # existing visual system

tests/facebook-live-manager.test.ts  # manager lifecycle/capacity/race coverage
tests/comment-queue.test.ts           # selective queue removal coverage
tests/web-runtime.test.ts             # server contract/static safety
```

## Code style

Keep the single-live poller focused and source-agnostic orchestration outside it:

```ts
const result = await manager.startLive(config, {
  onComment: (liveVideoId, comment) => handleGraphComment(liveVideoId, comment),
  onStatus: (liveVideoId, message, level) => broadcastStatus(liveVideoId, message, level),
});
```

Do not introduce a generic framework or global event bus for nine sessions.

## Testing strategy

- TDD for manager capacity, duplicate starts, concurrent-start races, per-live stop and stop-all.
- Preserve existing poller baseline/pagination/stale-request tests.
- Verify comments from two live IDs keep distinct `sourceId`s and do not cross-deduplicate.
- Verify stopping one live keeps other lives active and drops only waiting queue items from the stopped source.
- Full typecheck/tests/build on Ubuntu + Windows CI.
- Runtime merge gate: two real managed Facebook Lives active together, comments from both reach one sequential TTS queue.

## Boundaries

### Always
- Maximum 9 active/pending Facebook live sessions.
- One independent poller/AbortController lifecycle per live.
- Page token/API version remain server-side only.
- Shared TTS queue stays bounded and sequential.
- Comment source identity includes the Live Video ID.
- A failed new live must not disturb already-active lives.

### Ask first
- More than 9 concurrent lives.
- Separate TTS queues/voices per live.
- Auto-discovery of live videos.
- Webhooks/public HTTPS/authentication.
- New third-party dependencies.

### Never
- Put the Page token in browser state, URL/query params or logs.
- Reintroduce Facebook DOM scraping.
- Let one live's stop/error abort another live.
- Clear the entire shared queue when merely adding or stopping one live.

## Success criteria

1. Operator can add Live IDs/URLs until 9 sessions are active.
2. Adding the same live twice is rejected without affecting the existing session.
3. A 10th active/pending live is rejected without starting a Graph request.
4. Two simultaneous start requests cannot exceed the 9-live cap.
5. Each active live baselines independently and emits only post-connect comments.
6. Comments from different lives retain distinct source identity and share one FIFO TTS pipeline.
7. Stopping Live A leaves Live B…Live I running and removes only queued items belonging to A; currently playing audio may finish.
8. Stop-all terminates all pollers and clears the shared queue.
9. Browser shows active live IDs and lets the operator stop one or all.
10. FB-API TTS still speaks only exact comment content.
11. Existing token/origin/CSP/security boundaries remain intact.
12. Typecheck, full tests and build pass on Ubuntu + Windows.
13. Real runtime evidence proves two Facebook Lives can feed the same sequential TTS queue.

## Open questions

None blocking for this phase. Auto-discovery, per-live voices and >9 sessions remain explicitly deferred.
