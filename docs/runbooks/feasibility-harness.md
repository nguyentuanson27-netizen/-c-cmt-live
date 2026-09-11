# Feasibility Harness Runbook

Use this runbook on a Windows machine with GUI access to prove the current live-comment capture route for Facebook, TikTok, and Shopee.

The **current hard gate** for shared core/TTS work is Facebook + TikTok runtime capture. Shopee capture/integration is deferred by the approved 2026-09-10 scope amendment and must pass before Shopee final integration and before the full three-platform MVP is complete.

## 1. What to prepare

### Machine

- Windows machine with GUI
- Git
- Node.js/npm compatible with the repository dependencies
- network access to npm and the three platforms
- ability to open Electron windows and DevTools

### Accounts

Use two roles where practical:

1. **Host/operator account** — opens or owns the livestream.
2. **Viewer/test account** — sends clearly identifiable comments from another phone/browser/account.

Do not give passwords, OTPs, cookies, or tokens to the coding agent. Complete login/2FA manually in the Electron source window.

#### Facebook

Prepare:

- one Facebook account that can access/manage the Page used for the test live;
- one separate viewer/test Facebook account to post comments.

The MVP assumes all Facebook Pages used later are reachable through the same Facebook browser session. Multi-account Facebook is out of scope.

For the capture gate, test only **one** Facebook Live first. Multi-live 2 → 9 is a later verification step.

#### TikTok

Prepare:

- one TikTok account that can actually start/use LIVE;
- one separate viewer/test account to send comments.

The MVP supports one TikTok live at a time.

#### Shopee VN

Prepare when Shopee integration resumes:

- one Shopee shop/account that can actually use Shopee Live;
- one buyer/viewer account to send comments.

The MVP supports one Shopee live at a time. Shopee is currently deferred and is not required to unblock Facebook/TikTok core/TTS work.

## 2. Repository setup

```bash
git clone https://github.com/nguyentuanson27-netizen/-c-cmt-live.git
cd ./-c-cmt-live
git checkout feat/mvp-live-comment-tts
git status
git branch --show-current
```

Install dependencies:

```bash
npm install
```

If a reviewed `package-lock.json` exists, prefer:

```bash
npm ci
```

Run repository checks before runtime work:

```bash
npm run typecheck
npm test
npm run build
```

Record exact failures instead of skipping them.

## 3. Start the harness

```bash
npm run dev
```

Confirm the operator window opens and can:

- choose Facebook/TikTok/Shopee;
- accept a live URL;
- open the source window;
- open source DevTools;
- close the source window.

Expected security/session behavior:

- remote source audio is muted;
- source uses its persistent platform partition;
- URL outside the selected platform is rejected;
- unexpected popup/new-window is denied by the current harness;
- remote page has no Node API access.

If login requires a popup/SSO flow blocked by the harness, record that as evidence. Make only the smallest platform-specific policy change required for normal login; do not broadly disable the boundary.

## 4. Test markers

Use unique comments so there is no ambiguity about which event was captured.

Suggested markers:

```text
FB_TEST_001 con size M khong?
FB_TEST_002 gia bao nhieu?
FB_TEST_003 mau den con khong?

TT_TEST_001 con size M khong?
TT_TEST_002 gia bao nhieu?
TT_TEST_003 mau den con khong?

SP_TEST_001 con size M khong?
SP_TEST_002 gia bao nhieu?
SP_TEST_003 mau den con khong?
```

## 5. Facebook capture spike

1. Start one real Facebook Page livestream.
2. In the harness select Facebook and paste the live URL.
3. Open the source window.
4. Login manually if needed.
5. Open DevTools.
6. From the viewer/test account send `FB_TEST_001 con size M khong?`.
7. Inspect the current page.

Investigation order:

### First: DOM

Observe what changes when the new comment appears. Find the smallest current-page boundary that yields:

```text
username
text
```

Prefer stable structure/attributes over long generated class-name chains.

Do not accept a selector because it existed in an old repository or search result. It must be observed on the current page.

### Second: network/WebSocket

Only if the DOM does not expose a viable boundary, inspect Fetch/XHR/WebSocket traffic associated with the new comment.

Do not reverse-engineer more protocol surface than necessary to extract the two required fields.

### Facebook PASS criteria

PASS only after a real new comment is observed through the selected capture route with:

- correct viewer username;
- exact test marker text.

Then send `_002` and `_003` to confirm the route is repeatable.

Record evidence in `tasks/capture-findings.md`.

## 6. TikTok capture spike

1. Start a real TikTok LIVE using the host account.
2. Select TikTok in the harness and open the live URL.
3. Login manually if required.
4. Open DevTools.
5. Send `TT_TEST_001 con size M khong?` from the viewer account.
6. Investigate DOM first, then network/WebSocket only if DOM is non-viable.

PASS requires the exact viewer username and exact marker text from a real new live comment.

Repeat with `_002` and `_003` and record the current capture boundary.

Do not add an unofficial TikTok connector dependency while browser capture is sufficient.

## 7. Shopee capture spike — deferred

Run this section when Shopee integration resumes.

1. Start a real Shopee Live using the shop/account. It is fine for the host live to be started from a phone if that is how the account normally operates.
2. Select Shopee in the harness and open the viewer/live URL.
3. Login manually if required.
4. Open DevTools.
5. Send `SP_TEST_001 con size M khong?` from the buyer/viewer account.
6. Investigate DOM first, then network/WebSocket only if necessary.

PASS requires the exact viewer username and exact marker text from a real new live comment.

Repeat with `_002` and `_003` and record the result.

Do not move to Shopee Open Platform/API merely because the DOM is inconvenient. Change strategy only when runtime evidence shows the simpler browser route is not viable.

## 8. Implement the smallest proven capture

Once a platform route is observed, keep its code under:

```text
src/connectors/facebook/
src/connectors/tiktok/
src/connectors/shopee/
```

The remote page should emit only the minimum required comment payload. Main-process code must validate the sender and payload before accepting it.

Do not implement the full queue/TTS system during the spike.

## 9. Verification after capture code changes

Run:

```bash
npm run typecheck
npm test
npm run build
```

Then restart the Electron app and repeat the real-comment test.

If a small pure parser can be regression-tested without adding unnecessary tooling, add that focused test. Runtime evidence remains mandatory because the external platform owns the actual page behavior.

## 10. Gate result

The current Facebook/TikTok feasibility gate is complete only when:

```text
Facebook  PASS
TikTok    PASS
Shopee    DEFERRED or PASS
```

A required platform PASS must have:

- a real live comment;
- observed username;
- exact marker text;
- documented capture boundary;
- smallest corresponding connector code;
- relevant repository checks actually run.

If Facebook or TikTok fails, stop before shared core/TTS implementation and record the blocker plus at most 1–2 simplest evidence-based fallback options.

Before the full three-platform MVP is complete, Shopee must be resumed and reach PASS with the same evidence standard.

## 11. Safety / sensitive data

Never place these in screenshots, commits, issue/PR comments, or `capture-findings.md`:

- passwords
- OTP/2FA codes
- cookies
- session/access tokens
- authorization headers
- browser storage dumps

Sanitize DevTools screenshots/logs before sharing them.
