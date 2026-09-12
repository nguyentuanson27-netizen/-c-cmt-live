# Spec — Facebook Page Live Discovery

## Objective

Let the local web operator discover currently-live videos for the managed Facebook Page without copying a Live Video ID manually. Discovery is server-side: the Page Access Token and configured Graph API version stay on the Node server. The browser receives only bounded live-video metadata, the operator explicitly chooses a live, and the existing `/api/facebook/start` flow performs the actual connection/baseline/TTS work.

This is a focused follow-up to the proven 2–9 live runtime. It does not change polling, queueing, TTS, playback ownership, or the 9-live capacity limit.

## User flow

1. Operator opens the existing local web UI.
2. Operator clicks **Tìm live đang phát**.
3. Server queries the configured Facebook Graph API using the Page Access Token in the `Authorization` header.
4. UI renders discovered live IDs plus safe optional metadata such as title/status/creation time.
5. Operator clicks **Thêm** on one result.
6. The browser calls the existing `/api/facebook/start` endpoint with that live ID.

Manual Live Video ID/URL entry remains available and unchanged.

## API contract

### `GET /api/facebook/live-videos`

Success:

```json
{
  "ok": true,
  "lives": [
    {
      "id": "1234567890",
      "title": "Optional title",
      "status": "Optional status",
      "createdTime": "Optional Graph timestamp"
    }
  ]
}
```

The endpoint returns at most 25 entries. Only numeric IDs are returned. Optional string fields are trimmed and bounded before they cross the server/browser boundary.

Expected failures:
- `403` — untrusted browser origin.
- `503` — Page token/API version is not configured on the server.
- `502` — Graph discovery request failed, including invalid/expired token or permission/API errors.

The response must never contain the Page token, Authorization header, or a token-bearing URL.

## Graph request contract

Use the same explicit `FACEBOOK_GRAPH_API_VERSION` already configured for the runtime. Do not guess or upgrade versions in this PR.

Discovery requests the managed Page edge through:

```text
GET https://graph.facebook.com/<configured-version>/me/live_videos
Authorization: Bearer <Page Access Token>
```

Request parameters are bounded and request safe metadata only:
- live-only server filter: `broadcast_status=LIVE`
- `fields=id,title,status,creation_time`
- `limit=25`

Meta's current Page `live_videos` reference was not reliably reachable during implementation (official documentation requests were rate-limited), so this exact discovery contract must be runtime-verified against the actual Meta app/Page before merge-ready status. Automated mocks prove our request/security/normalization behavior but do not substitute for that integration gate.

## Security boundaries

### Always
- Keep `FACEBOOK_PAGE_ACCESS_TOKEN` server-side.
- Send the token only in the `Authorization: Bearer ...` header.
- Reuse the explicitly configured Graph API version.
- Require trusted loopback browser origin for the discovery endpoint.
- Validate and bound every Graph response field before returning it to the browser.
- Render external title/status text with DOM `textContent`, never HTML injection.

### Ask first
- New Facebook permissions/features or a different token model.
- Public/LAN deployment, authentication, webhooks, or HTTPS callback infrastructure.
- Auto-starting discovered lives without operator action.
- Raising the 9-live capacity.

### Never
- Put Page tokens in browser state, query strings, URLs, logs, or SSE payloads.
- Reintroduce Facebook DOM scraping.
- Pin a guessed Graph API version.
- Treat discovery failure as a reason to stop already-active live sessions.

## Testing strategy

- Unit-test the Graph request URL, filter, fields, bounded limit, and Authorization-only token handling.
- Unit-test malformed/oversized Graph entries are dropped or bounded before return.
- Unit-test code `190` produces a sanitized invalid/expired-token error.
- Keep all existing Graph polling, multi-live, core queue/TTS, and web-runtime tests green.
- CI must pass install, typecheck, tests, and build on Ubuntu + Windows.

## Success criteria

1. Discovery uses the configured Graph version and server-side Page token only.
2. Browser receives safe live metadata and never receives the Page token.
3. Discovery returns an empty list cleanly when no active live is found.
4. Malformed Graph entries cannot inject arbitrary markup or unbounded data into the UI.
5. A discovered live can be added through the existing start flow; manual ID/URL entry remains functional.
6. Discovery failure does not disturb existing active/pending live sessions or the TTS queue.
7. Full automated verification passes on Ubuntu + Windows.
8. Real Meta runtime verification proves at least one active managed-Page live is discovered and can be connected from the discovery result, with no Page-token leak.

## Merge gate

PR #7 remains **Draft** until success criterion 8 is recorded in `tasks/capture-findings.md`. The current Meta documentation uncertainty around the Page live-video discovery edge makes real runtime evidence mandatory for merge-ready status.
