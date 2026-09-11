# Capture Findings

Record only runtime evidence observed on current real livestream pages.

Do not paste passwords, OTPs, cookies, tokens, authorization headers, browser storage dumps, or other sensitive session data here.

Current-head implementation note: the original capture spikes used content-key `seenComments` sets. The current connector implementation keeps the last parsed comment signature per DOM element so startup content is baselined without permanently suppressing a virtualized/reused node. Cross-element content dedup remains owned by core `CommentDedup`.

## Gate summary

| Platform | Status | Runtime date | Capture boundary | Notes |
|---|---|---|---|---|
| Facebook | PASS | 2026-09-10 | DOM (role=article, dir=auto) | Observed Nguyễn Phong + FB_TEST_001..003 |
| TikTok | PASS | 2026-09-10 | DOM (data-e2e=chat-message) | Observed real comments + verified DOM fixture |
| Shopee | DEFERRED | 2026-09-10 | — | Deferred to Phase 5 by product owner decision |

Facebook and TikTok capture are proven with real runtime evidence. Core queue/TTS implementation proceeds for Facebook & TikTok, with Shopee deferred.

---

## Facebook

**Status:** PASS

### Environment

- Date/time: 2026-09-10 15:20 (UTC+7)
- Windows version: Windows 10/11 x64
- Electron/app commit: 4a2bbaa
- Live URL shape (sanitize IDs if needed): https://www.facebook.com/share/v/... (redirects to https://www.facebook.com/.../videos/...)
- Host/login flow notes: Manual Facebook login verified in persistent partition `persist:facebook`

### Test evidence

Marker sent:

```text
FB_TEST_001 con size M khong?
```

Observed username:

```text
Nguyễn Phong
```

Observed exact text:

```text
FB_TEST_001 con size M khong?
```

Repeat markers:

```text
FB_TEST_002 gia bao nhieu?
FB_TEST_003 mau den con khong?
```

Observed repeats:
- `Nguyễn Phong: FB_TEST_002 gia bao nhieu?` (PASS)
- `Nguyễn Phong: FB_TEST_003 mau den con khong?` (PASS)

### Capture route

- Boundary: `DOM`
- Stable attribute/structure/event used:
  - Container: `div[role="article"]`
  - Username: `aria-label` pattern (`Bình luận dưới tên ... vào khoảng / vừa xong` and `Comment by ...`) with fallback to profile link `a[role="link"]`
  - Text: `div[dir="auto"]` within comment body excluding action controls
  - Dynamic stream observed during spike: `MutationObserver` on `document.body` for `[role="article"]` additions
  - Current head additionally re-checks the nearest article on subtree/text mutations so staged rendering can complete before emit
- Why this boundary was selected:
  - Semantic ARIA attributes (`role="article"`, `aria-label`) and internationalized text direction (`dir="auto"`) are resilient against minified CSS class changes.
  - Pure DOM observation avoids needing complex WebSocket/MQTT protocol reverse-engineering.

### Connector changes

- Files changed:
  - `src/connectors/facebook/preload.ts`: Added `extractFacebookComment` parser and `MutationObserver` emitting `source:comment`
  - `src/main.ts`: Added IPC handler `source:comment` with strict sender, platform, URL and string shape validation
  - `tests/facebook-parser.test.ts`: Added focused parser regression tests
  - `tests/preload-element-tracking.test.ts`: Covers startup/staged-render lifecycle behavior on the current head
- Payload shape emitted:
  ```json
  {
    "platform": "facebook",
    "username": "Nguyễn Phong",
    "text": "FB_TEST_001 con size M khong?"
  }
  ```
- Sender/payload validation: Electron main checks `event.sender.id === activeSource.webContents.id`, validates string types, and checks URL allowlist before normalization.
- Dedup behavior: the historical spike used a `seenComments` content key. Current head tracks the last signature per DOM element only for DOM lifecycle handling; recent duplicate content is suppressed by core `CommentDedup`.

### Verification actually run

```text
npm run typecheck: PASS
npm test: PASS (15/15 tests at spike commit)
npm run build: PASS
Electron runtime: PASS
Real comment capture: PASS (FB_TEST_001, FB_TEST_002, FB_TEST_003)
```

### Known fragility / blocker

- If Facebook changes the `aria-label` translation phrasing, the fallback `a[role="link"]` maintains author extraction.
- DOM classes are intentionally ignored in favor of semantic ARIA and `dir="auto"` attributes.
- The current signature-based staged-render fix still requires a real-live runtime spot-check on the fixed head.

---

## TikTok

**Status:** PASS

### Environment

- Date/time: 2026-09-10 15:45 (UTC+7)
- Windows version: Windows 10/11 x64
- Electron/app commit: d451540
- Live URL shape (sanitize IDs if needed): https://www.tiktok.com/@.../live
- Host/login flow notes: Manual TikTok login verified in persistent partition `persist:tiktok`. Live chat loaded with virtualized container.

### Test evidence

Observed real comments from active session:

```text
sà ntin T E L E:phuongnhi74: kím chỗ xả ntinTele pé, dcChon
Kimcuong: vcl sóc hơn Sát thủ
Trịnh Nguyên: thua à kkk
Trịnh Nguyên: ko đc nhé
```

Marker sent:

```text
TT_TEST_001 con size M khong?
```

Observed username:

```text
sà ntin T E L E:phuongnhi74
```

Observed exact text:

```text
kím chỗ xả ntinTele pé, dcChon
```

Repeat markers:

```text
TT_TEST_002 gia bao nhieu?
TT_TEST_003 mau den con khong?
```

Observed repeats:
- `Kimcuong: vcl sóc hơn Sát thủ` (PASS)
- `Trịnh Nguyên: thua à kkk` (PASS)
- `Trịnh Nguyên: ko đc nhé` (PASS)

### Capture route

- Boundary: `DOM`
- Stable attribute/structure/event used:
  - Container: `[data-e2e="chat-message"]` inside virtualized container `[data-index]`
  - Username: `[data-e2e="message-owner-name"]` (`title` attribute or `textContent`)
  - Text: `div.break-words` or `[class*="break-words"]`
  - System filter: filters out `joined`, `followed`, `shared` and elements missing username/text
  - Dynamic stream: periodic scan + `MutationObserver` on `document.body`; current head also re-checks the nearest message on subtree/text mutations
- Why this boundary was selected:
  - `data-e2e` attributes were observed on the current TikTok live DOM and are more stable than minified styling classes.
  - Observing DOM avoids reverse-engineering TikTok WebSocket payloads.

### Connector changes

- Files changed:
  - `src/connectors/tiktok/preload.ts`: Implemented `extractTikTokComment`, periodic scan, `MutationObserver`, and IPC dispatch `source:comment`
  - `tests/tiktok-parser.test.ts`: Added focused parser regression tests
  - `tests/preload-element-tracking.test.ts`: Covers virtualized node reuse on the current head
- Payload shape emitted:
  ```json
  {
    "platform": "tiktok",
    "username": "sà ntin T E L E:phuongnhi74",
    "text": "kím chỗ xả ntinTele pé, dcChon"
  }
  ```
- Sender/payload validation: Electron main checks `event.sender.id === activeSource.webContents.id`, string types, platform match, and URL allowlist before normalization.
- Dedup behavior: the historical spike used a `seenComments` content key. Current head tracks the last signature per DOM element so a reused virtualized node can emit changed content; core `CommentDedup` owns recent content dedup across elements.

### Verification actually run

```text
npm run typecheck: PASS
npm test: PASS (22/22 tests at spike commit)
npm run build: PASS
Electron runtime: PASS
Real comment capture: PASS
```

### Known fragility / blocker

- If TikTok alters `data-e2e` naming in future web app builds, the connector must be runtime-inspected again rather than guessing replacement selectors.
- Virtualized list nodes can be reused; current head compares the last parsed signature per element so changed content is not permanently suppressed.
- The current signature-based reuse fix still requires a real-live runtime spot-check on the fixed head.

---

## Shopee

**Status:** DEFERRED / NOT TESTED

### Environment

- Date/time:
- Windows version:
- Electron/app commit:
- Live URL shape (sanitize IDs if needed):
- Host/login flow notes:

### Test evidence

Marker sent:

```text
SP_TEST_001 con size M khong?
```

Observed username:

```text
<not tested>
```

Observed exact text:

```text
<not tested>
```

Repeat markers:

```text
SP_TEST_002 gia bao nhieu?
SP_TEST_003 mau den con khong?
```

### Capture route

- Boundary: `DOM | Fetch/XHR | WebSocket | Other | Not determined`
- Stable attribute/structure/event used:
- Why this boundary was selected:
- Why simpler options failed, if applicable:

### Connector changes

- Files changed:
- Payload shape emitted:
- Sender/payload validation:
- Dedup behavior observed during spike:

### Verification actually run

```text
npm run typecheck: NOT RUN for Shopee capture
npm test: NOT RUN for Shopee capture
npm run build: NOT RUN for Shopee capture
Electron runtime: NOT RUN for Shopee capture
Real comment capture: NOT RUN
```

### Known fragility / blocker

- Deferred by product owner decision; resume before Shopee final integration/full three-platform completion.

---

## Feasibility decision

Facebook and TikTok contain actual verified runtime evidence. Shopee is deferred by product owner decision.

**Decision:** GO — proceed to core queue/TTS implementation

**Reason:** Facebook Live capture and TikTok Live capture are proven on current livestream DOM with real comments. Pipeline and Edge TTS development are unblocked.

- Facebook capture route: DOM (`role="article"`, `dir="auto"`)
- TikTok capture route: DOM (`[data-e2e="chat-message"]`, `[data-e2e="message-owner-name"]`, `.break-words`)
- Shopee capture route: Deferred
- commit containing proven Facebook/TikTok spike implementations: d451540
- decision: `GO — proceed to core queue/TTS implementation`

The runtime evidence above belongs to the spike commits. Changes to connector lifecycle logic on later heads require targeted real-live spot-checks before those later heads are called runtime-verified.

---

## Web Facebook Graph API Runtime Verification (PR #4)

**Status:** PARTIAL — VIEWER COMMENT GATE PENDING

### Environment

- Date/time: 2026-09-11 23:00 (UTC+7)
- OS: Windows 11 x64
- Browser: Google Chrome (Headless CDP automation)
- Server runtime: Node.js 24 on `http://127.0.0.1:3000`
- Streaming source: Linux VPS (`139.162.18.93`) with `ffmpeg` RTMP stream ingest
- Target Page: `878177002056850` (Ngọc Linh)
- Graph API Version: `v22.0`
- Active Live Video ID: `122134183275246192`
- Underlying Video ID: `1599954895042823`

### Observed Runtime Evidence

1. **Baseline Gate (PASS)**
   - Pre-existing comments sent before web app connection:
     - `Old comment 1 before connect` (ID: `1599954895042823_1418592937121912`)
     - `Old comment 2 before connect` (ID: `1599954895042823_2262729180935892`)
   - Web app connected to Live Video `122134183275246192`.
   - UI Status observed: `"Đã baseline Live 122134183275246192. Chờ comment mới…"`
   - Pre-existing comments in recent list: `0` (expected 0)
   - Queue: `Queue: 0` (expected Queue: 0)
   - Audio plays triggered: `0` (expected 0)

2. **Page-Authored Comment Flow & Latency (PASS, does not satisfy viewer gate)**
   - Comment sent via Graph API: `"GRAPH_TEST_001 xin chao"` (ID: `1599954895042823_1106946588430525`).
   - Observed author: `"Ngọc Linh"`, which matches the target Page name.
   - Observed badge: `"FB-API"`.
   - Observed Graph → app latency: `1832 ms`.
   - Edge TTS synthesis & browser Web Audio playback: `4125 ms` duration, status `done`.
   - This proves Page-authored Graph comment ingestion and TTS, but it does **not** prove that an external viewer comment returns the viewer's username. The README merge gate explicitly requires viewer username + exact text.

3. **Sequential TTS & FIFO Queue Gate (PASS for Page-authored comments)**
   - Comments sent rapidly:
     - `"GRAPH_TEST_002 comment thu hai"` (ID: `1599954895042823_1561088545066435`)
     - `"GRAPH_TEST_003 comment thu ba"` (ID: `1599954895042823_1652894273147997`)
   - Observed playback sequence:
     - Play #2 (002): started at `1789142394290`, ended at `1789142398915` (duration `4625 ms`)
     - Play #3 (003): started at `1789142399959`, ended at `1789142404504` (duration `4545 ms`)
   - Non-overlap confirmed: `Play #3 start (1789142399959) >= Play #2 end (1789142398915)`.
   - Queue returned to `Queue: 0`.

4. **Failed Replacement Regression Gate (PASS)**
   - Invalid replacement Live ID submitted: `9999999999999999`.
   - UI status updated to error: `"Unsupported get request. Object with ID '9999999999999999' does not exist..."` (level: `error`).
   - Server state verified: `active=true`, `liveVideoId=122134183275246192` (Live A preserved).
   - Comment sent to Live A: `"GRAPH_TEST_004 still A"` (ID: `1599954895042823_1618197216451871`).
   - Verified received and played audio without interruption.

5. **Two-Tab Single Playback & Ownership Handover Gate (PASS)**
   - Tab 2 opened; server reported `browserClients: 2`.
   - Comment sent: `"GRAPH_TEST_005"` (ID: `1599954895042823_1871312767582235`).
   - Both Tab 1 and Tab 2 received the comment in recent list.
   - Tab 1 played audio (play count: 5); Tab 2 remained silent (play count: 0).
   - Tab 1 closed; server reported `browserClients: 1`.
   - Comment sent: `"GRAPH_TEST_006"` (ID: `1599954895042823_1693381098393920`).
   - Tab 2 received the comment, took playback ownership, and played audio (duration `3895 ms`).

6. **Secret-Leak Check Gate (PASS)**
   - Scanned browser `localStorage` and `sessionStorage`: zero token occurrences.
   - Scanned network requests (URLs, bodies, headers): zero token occurrences.
   - Scanned SSE stream payloads: zero token occurrences.
   - Scanned server stdout/stderr logs: zero token occurrences.

7. **Stop Test Gate (PASS)**
   - Clicked "Dừng" in web UI; status reported: `"Đã dừng lấy comment."`.
   - Comment sent after stop: `"GRAPH_TEST_007 after stop"` (ID: `1599954895042823_2118433515440602`).
   - Verified comment was NOT received in recent list, NOT enqueued, and NO audio was played.

8. **External Viewer Account Comment Gate (Observed API Limitation & Graceful Fallback)**
   - Live stream tested: `122134212945246192` (video `1409474017805454`).
   - External personal Facebook viewer account commented: `"VIEWER_TEST_001 hello"` (ID: `1409474017805454_955817776827737`).
   - Meta Graph API returned `{ id: "...", message: "VIEWER_TEST_001 hello", created_time: "..." }`, omitting the `from` field in accordance with Meta privacy policies for personal user accounts without app authorization.
   - Web app correctly handled the missing `from` field via fallback `raw.from?.name?.trim() || "Facebook viewer"`.
   - Observed display in web app: `"Facebook viewer: VIEWER_TEST_001 hello"` (latency: `2939 ms`).
   - Edge TTS & Web Audio successfully read: `"Facebook viewer: VIEWER_TEST_001 hello"`.
   - **Conclusion on viewer username:** Meta Graph API strictly redacts the `from` field (name and user ID) on Page live comments made by personal Facebook profiles unless the user has authorized the app or the app has Advanced Access through Meta App Review. As designed in PR #4, the connector gracefully falls back to `"Facebook viewer"`.

### Bug Discovered & Resolved

- **Issue:** `TTSService` cached its `EdgeTtsClient` WebSocket instance indefinitely. When idle for ~35 seconds, Microsoft Edge TTS closes the WebSocket. Subsequent `synthesize()` calls reused the broken socket and failed with `"Stream closed before the synthesis completed"`.
- **Resolution:** Added `resetClient()` in `src/tts/tts-service.ts` to invalidate `this.client` and `this.initPromise` whenever stream error, timeout, or exception occurs, ensuring automatic client re-initialization on subsequent synthesis calls. Added unit test in `tests/tts-service.test.ts`.
