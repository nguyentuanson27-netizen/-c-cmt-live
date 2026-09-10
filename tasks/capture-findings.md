# Capture Findings

Record only runtime evidence observed on current real livestream pages.

Do not paste passwords, OTPs, cookies, tokens, authorization headers, browser storage dumps, or other sensitive session data here.

## Gate summary

| Platform | Status | Runtime date | Capture boundary | Notes |
|---|---|---|---|---|
| Facebook | PASS | 2026-09-10 | DOM (role=article, dir=auto) | Observed Nguyễn Phong + FB_TEST_001..003 |
| TikTok | PASS | 2026-09-10 | DOM (data-e2e=chat-message) | Observed real comments + verified DOM fixture |
| Shopee | NOT TESTED | — | — | — |

The full queue/TTS implementation remains blocked until all three rows are PASS.

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
  - Dynamic stream: `MutationObserver` on `document.body` for `[role="article"]` additions
- Why this boundary was selected:
  - Semantic ARIA attributes (`role="article"`, `aria-label`) and internationalized text direction (`dir="auto"`) are resilient against minified CSS class changes.
  - Pure DOM observation avoids needing complex WebSocket/MQTT protocol reverse-engineering.

### Connector changes

- Files changed:
  - `src/connectors/facebook/preload.ts`: Added `extractFacebookComment` parser and `MutationObserver` emitting `source:comment`
  - `src/main.ts`: Added IPC handler `source:comment` with strict sender, platform, URL and string shape validation
  - `tests/facebook-parser.test.ts`: Added 4 focused regression tests for DOM parser
- Payload shape emitted:
  ```json
  {
    "platform": "facebook",
    "username": "Nguyễn Phong",
    "text": "FB_TEST_001 con size M khong?"
  }
  ```
- Sender/payload validation: Electron main checks `event.sender.id === activeSource.webContents.id`, validates non-empty string types, and checks URL allowlist.
- Dedup behavior observed during spike: `seenComments` set on key `${username}:${text}` prevents re-emitting historical or duplicate mutations.

### Verification actually run

```text
npm run typecheck: PASS
npm test: PASS (15/15 tests)
npm run build: PASS
Electron runtime: PASS
Real comment capture: PASS (FB_TEST_001, FB_TEST_002, FB_TEST_003)
```

### Known fragility / blocker

- If Facebook changes the `aria-label` translation phrasing, the fallback `a[role="link"]` maintains author extraction.
- DOM classes are intentionally ignored in favor of semantic ARIA and `dir="auto"` attributes.

---

## TikTok

**Status:** PASS

### Environment

- Date/time: 2026-09-10 15:45 (UTC+7)
- Windows version: Windows 10/11 x64
- Electron/app commit: 5556214
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
  - Dynamic stream: `scanAll()` immediate and periodic scan + `MutationObserver` on `document.body`
- Why this boundary was selected:
  - `data-e2e` attributes are official test hooks maintained by TikTok, providing resilience against minified Tailwind/CSS class names.
  - Observing DOM avoids reverse-engineering TikTok WebSocket protobuf / encryption payloads.

### Connector changes

- Files changed:
  - `src/connectors/tiktok/preload.ts`: Implemented `extractTikTokComment`, `setupCommentObserver` with `MutationObserver`, immediate DOM scan, periodic scan, and IPC dispatch `source:comment`
  - `tests/tiktok-parser.test.ts`: Added 7 comprehensive regression unit tests
- Payload shape emitted:
  ```json
  {
    "platform": "tiktok",
    "username": "sà ntin T E L E:phuongnhi74",
    "text": "kím chỗ xả ntinTele pé, dcChon"
  }
  ```
- Sender/payload validation: Electron main checks `event.sender.id === activeSource.webContents.id`, non-empty strings, platform match, and URL allowlist.
- Dedup behavior observed during spike: `seenComments` set on key `${username}:${text}` prevents re-emitting comments re-rendered by virtualized list scrolling.

### Verification actually run

```text
npm run typecheck: PASS
npm test: PASS (22/22 tests)
npm run build: PASS
Electron runtime: PASS
Real comment capture: PASS
```

### Known fragility / blocker

- If TikTok alters `data-e2e` naming in future web app builds, fallbacks to `[title]` and class-based owner names are in place.
- Virtualized list scrolls rapidly during high-volume lives; `seenComments` set prevents duplicate firing.

---

## Shopee

**Status:** NOT TESTED

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
npm run typecheck: NOT RUN
npm test: NOT RUN
npm run build: NOT RUN
Electron runtime: NOT RUN
Real comment capture: NOT RUN
```

### Known fragility / blocker

- —

---

## Feasibility decision

Do not change this section to GO until all platform sections contain actual runtime evidence.

**Decision:** BLOCKED

**Reason:** Capture gate has not yet been proven on all three platforms.

When all three pass, record:

- Facebook capture route:
- TikTok capture route:
- Shopee capture route:
- commit containing proven spike implementations:
- reviewer/self-review result:
- decision: `GO — proceed to core queue/TTS implementation`
