# AGENTS.md

This repository is a **local web operator app** for reading managed Facebook Page Live comments aloud with Vietnamese TTS.

The current runtime is **Node.js + Facebook Graph API + browser UI**. Electron/browser-DOM capture is historical only and must not be reintroduced as an active Facebook path.

## Source of truth

Read these before changing code:

1. `docs/specs/facebook-graph-multi-live.md` — current 2–9 Facebook Live contract.
2. `docs/specs/facebook-graph-web-mvp.md` — single-live Graph foundations and security boundary.
3. `docs/adr/0002-web-graph-api-runtime.md` — current architecture decision.
4. `README.md` — operator setup and current runtime behavior.
5. `tasks/plan.md` / `tasks/todo.md` — current work only.
6. `tasks/capture-findings.md` — recorded runtime evidence.
7. `docs/adr/0001-electron-local-browser-capture.md` — superseded history; not implementation guidance.

If current docs conflict, the current Graph multi-live spec and accepted ADR 0002 win unless the user explicitly changes the requirement.

## Current product contract

- Facebook ingestion uses server-side Graph API polling, not DOM scraping.
- Support 2–9 active or connecting managed Facebook Live sessions.
- Each live has an independent polling lifecycle and source identity.
- Accepted comments share one bounded FIFO TTS queue.
- Facebook TTS speaks **comment content only**; do not require or speak viewer names.
- Stop-one must not disturb other live sessions; stop-all clears all sessions/waiting queue.
- Browser playback ownership is single-owner with handover on disconnect.
- TikTok/Shopee web ingestion is deferred and must not be represented as implemented.

## Implementation rules

- Prefer the simplest solution that satisfies the current contract.
- Keep Facebook Graph source logic under `src/server/`; keep generic queue/TTS primitives under `src/core/` and `src/tts/`.
- Do not add Electron, browser-DOM scraping, Playwright/Puppeteer/Selenium, databases, Redis, message brokers, DI containers, event buses or generic plugin frameworks without a new requirement.
- Do not guess Meta Graph API versions. `FACEBOOK_GRAPH_API_VERSION` is explicit configuration and must be verified against the actual Meta app/dashboard when runtime behavior is tested.
- Do not refactor unrelated code.

## Security minimum

Facebook Graph responses, operator input and livestream comments are untrusted input.

Always preserve:

- server binding to loopback only for the current product;
- Page Access Token server-side only;
- bearer token in the Graph `Authorization` header, never browser state/query strings;
- bounded/validated HTTP JSON bodies;
- origin checks for local POST/SSE boundaries;
- CSP/security headers on the web UI;
- safe browser rendering (`textContent` or equivalent) for external text;
- no token/cookie/authorization-header logging.

Never commit or log passwords, OTP/2FA codes, cookies, access/session tokens, authorization headers or full browser storage dumps.

Public hosting, non-loopback binding, authentication, webhooks or additional external integrations require a separate security/architecture decision.

## Verification honesty

Keep these states separate:

- **Implemented** — code/docs exist.
- **Verified** — command/runtime behavior was actually observed.
- **Not verified** — still requires environment, account, live session or external dependency access.

For repository checks use the commands that actually exist in `package.json`:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

Changes to Graph ingestion, concurrency, queueing, playback ownership or token handling require appropriate runtime evidence in addition to automated tests. Pure cleanup that does not change the active web behavior still requires full typecheck/tests/build and CI on Ubuntu + Windows.

## Runtime evidence

Record material runtime checks in `tasks/capture-findings.md` without secrets. For Facebook Graph, record the tested commit, Live IDs when safe, exact marker text, observed latency, queue/playback result and secret-boundary checks relevant to the change.

## Review order

Before considering a change complete, review in this order:

1. correctness
2. security
3. architecture
4. simplicity
5. performance

Keep README/spec/plan/todo aligned with current truth.
