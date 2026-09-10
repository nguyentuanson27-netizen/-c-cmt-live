# Capture Findings

Record only runtime evidence observed on current real livestream pages.

Do not paste passwords, OTPs, cookies, tokens, authorization headers, browser storage dumps, or other sensitive session data here.

## Gate summary

| Platform | Status | Runtime date | Capture boundary | Notes |
|---|---|---|---|---|
| Facebook | NOT TESTED | — | — | — |
| TikTok | NOT TESTED | — | — | — |
| Shopee | NOT TESTED | — | — | — |

The full queue/TTS implementation remains blocked until all three rows are PASS.

---

## Facebook

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
FB_TEST_001 con size M khong?
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
FB_TEST_002 gia bao nhieu?
FB_TEST_003 mau den con khong?
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

## TikTok

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
TT_TEST_001 con size M khong?
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
TT_TEST_002 gia bao nhieu?
TT_TEST_003 mau den con khong?
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
