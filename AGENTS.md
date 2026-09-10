# AGENTS.md

This repository is an internal Windows MVP for reading livestream comments aloud from Facebook Live, TikTok Live, and Shopee Live.

## Source of truth

Read these before changing code:

1. `docs/specs/live-comment-tts-mvp.md` — approved product/technical contract.
2. `tasks/plan.md` — ordered implementation plan and gates.
3. `tasks/todo.md` — current execution status.
4. `docs/runbooks/feasibility-harness.md` — manual runtime procedure for the platform capture spikes.
5. `tasks/capture-findings.md` — record runtime evidence here.
6. `docs/adr/0001-electron-local-browser-capture.md` — architecture rationale.

If docs conflict, the approved MVP spec wins unless the user explicitly changes the requirement.

## Current hard gate

The approved scope amendment on 2026-09-10 defers Shopee capture/integration while Facebook and TikTok are completed first.

Before building the shared core/TTS path, require proven runtime capture for:

- Facebook Live: real `username + text`
- TikTok Live: real `username + text`

Shopee Live is currently deferred and does **not** block the Facebook/TikTok core, TTS, or Facebook multi-live work. However, the full three-platform MVP must not be called complete until Shopee also has a proven runtime capture route and is integrated end-to-end.

A platform is not PASS because a selector looks plausible. PASS requires a real new comment observed end-to-end on a current livestream page.

## Implementation rules

- Prefer the simplest solution that satisfies the current MVP.
- Keep platform-specific capture code under `src/connectors/<platform>/`.
- Do not introduce backend services, databases, Redis, message brokers, DI containers, event buses, or a generic plugin framework.
- Do not add Playwright/Puppeteer/Selenium while Electron source windows can perform the required runtime inspection/capture.
- Try DOM observation first. Inspect network/WebSocket only when DOM capture is actually non-viable.
- Do not guess selectors from memory or silently copy stale selectors from old projects.
- Do not use official platform APIs unless needed to unblock the simplest viable capture route.
- Do not disable Electron background throttling unless a runtime test proves it is necessary.
- Do not refactor unrelated code.

## Security minimum

Remote Facebook/TikTok/Shopee pages and livestream comments are untrusted input.

Always preserve:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- muted source-window audio
- platform URL allowlist
- unexpected popup/new-window blocking
- IPC sender + payload validation
- output encoding/sanitization before embedding comment text into another format such as SSML

Never expose raw `ipcRenderer`, `require`, `fs`, `shell`, or other Node privileges to remote pages.

Never commit or log:

- passwords
- OTP/2FA codes
- cookies or cookie dumps
- access/session tokens
- authorization headers
- full browser storage dumps

Do not bypass CAPTCHA, 2FA, anti-bot checks, or login challenges. Ask the operator to complete them manually.

## Verification honesty

Keep these states separate:

- **Implemented** — code/docs exist.
- **Verified** — command/runtime behavior was actually observed.
- **Not verified** — still requires environment, account, live session, or dependency access.

Never mark a task complete because code compiles visually or because a previous implementation elsewhere behaved similarly.

For repository checks, use the commands that actually exist in `package.json`, currently:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

## Runtime evidence

For each capture spike, record in `tasks/capture-findings.md`:

- platform
- PASS/FAIL/DEFERRED
- test marker used
- observed username
- observed exact comment text
- capture boundary: DOM / network / WebSocket
- selector/event rationale
- commands/checks actually run
- known fragility or blocker

Do not record sensitive account/session data.

## Review order

Before considering a change complete, review in this order:

1. correctness
2. security
3. architecture
4. simplicity
5. performance

Optimize only after measurement. Keep README/spec/plan/todo aligned with current truth.
