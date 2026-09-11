# Live Comment TTS — MVP Spec

**Status:** Approved, implementation started

**Scope amendment — 2026-09-10:** Facebook and TikTok capture are proven and may proceed through shared core/TTS implementation. Shopee capture/integration is deferred to the later platform-integration phase and does not block Facebook/TikTok core/TTS work. The full three-platform MVP is not complete until Shopee is proven and integrated.

## Goal

Build a small Windows desktop app for internal use that reads livestream comments aloud in Vietnamese.

Supported platform modes:

- Facebook Live
- TikTok Live
- Shopee Live (deferred integration)

Only one platform mode is active at a time.

## Usage contract

### Facebook

- One persistent Facebook browser session.
- Up to **9 Facebook Live pages at the same time**.
- Comments from all active Facebook lives are merged into one FIFO TTS queue.
- Page/source name is visible in the UI/logs but is **not** spoken.
- Multiple independent Facebook accounts/profiles are out of scope for MVP.

### TikTok

- One account/session.
- One livestream at a time.

### Shopee

- One account/session.
- One livestream at a time.
- Capture and final integration are currently deferred; this does not block Facebook/TikTok core/TTS implementation.

## Spoken format

```text
Tên khách: nội dung comment
```

Do not speak platform name or Facebook Page name.

## Architecture

Use one Electron + TypeScript application.

```text
Remote live page(s)
      ↓
platform preload/parser
      ↓
Comment
      ↓
normalize → dedup → filter → stale check
      ↓
bounded FIFO queue
      ↓
Edge TTS
      ↓
local audio playback
```

MVP does **not** use a backend server, database, Redis, message broker, microservices, Playwright, Puppeteer, or Selenium.

## Feasibility gate

Before building the shared core/TTS path, prove that the currently active platforms can expose at least one real new livestream comment to the Electron process.

For a platform spike to pass, a real live page must provide:

- username
- comment text

Current required order:

1. Facebook spike — required before shared core/TTS
2. TikTok spike — required before shared core/TTS
3. Shopee spike — deferred; required before Shopee final integration and full three-platform MVP completion

After Facebook and TikTok have proven runtime capture routes, Tasks for the shared comment pipeline, TTS, and Facebook multi-live may proceed. Shopee being deferred does not block those tasks.

Do **not** guess long-lived DOM selectors from memory. Inspect the current live page at runtime. If DOM observation is not viable for a platform, inspect the simplest next boundary (for example page network/WebSocket traffic) before choosing another connector strategy.

## Browser/session rules

Use persistent Electron partitions:

```text
persist:facebook
persist:tiktok
persist:shopee
```

The user logs in manually. The app does not store usernames or passwords.

Remote windows must use at minimum:

```ts
{
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
}
```

Also:

- mute livestream audio;
- allow only platform hostnames for remote source windows;
- block unexpected popups/new windows;
- validate IPC payload shapes and senders at privileged boundaries;
- never expose raw `ipcRenderer`, `fs`, `shell`, `require`, or Node APIs to the remote page.

Do not disable background throttling unless runtime testing proves it is necessary.

## Comment contract

```ts
type Platform = "facebook" | "tiktok" | "shopee";

type Comment = {
  id: string;
  platform: Platform;
  sourceId: string;
  sourceLabel?: string;
  username: string;
  text: string;
  receivedAt: number;
};
```

Keep the connector boundary minimal:

```ts
interface CommentSource {
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

No plugin framework, DI container, event bus, or generic registry is required.

## Comment processing

Minimum behavior:

- trim username/text;
- normalize whitespace;
- reject empty username/text;
- cap TTS text at 250 characters;
- deduplicate recent comments;
- do not emit comments already present in the source DOM when the connector starts;
- optionally skip URLs;
- optionally skip blocked keywords.

Queue rules:

- one global FIFO queue;
- maximum 30 waiting comments;
- when full, drop the oldest waiting comment;
- never overlap TTS playback;
- when dequeuing, skip comments older than 30 seconds.

## TTS

Initial engine: `msedge-tts`.

Default Vietnamese voice: `vi-VN-HoaiMyNeural`.

Text format:

```ts
`${comment.username}: ${comment.text}`
```

The spoken-format string remains plain text. Before passing untrusted text into the TTS library's SSML envelope, XML-sensitive characters must be escaped.

Audio playback must wait for the current audio to end/fail before taking the next item. Retry one TTS/playback failure once, then skip and continue.

## UI

Use vanilla HTML/CSS/TypeScript.

Main UI needs only:

- platform selector;
- Facebook list of up to 9 live URLs with Open/Start/Stop/Remove;
- one URL + Connect/Stop/Open for TikTok;
- one URL + Connect/Stop/Open for Shopee when Shopee integration resumes;
- TTS enable/voice/rate/test/clear queue;
- current speaking text + queue size;
- recent in-memory comments with source label.

Recent-comment rendering must consume structured comment fields rather than reparsing a human-readable status string.

## Persistence

Use a local JSON config in Electron `userData`.

Store URLs and user settings only. Do not store passwords, cookie dumps, access tokens, auth headers, or browser storage dumps in config/logs.

## Testing

Unit-test behavior that does not require a live platform:

- FIFO ordering;
- max queue and oldest-drop behavior;
- stale comment skipping;
- dedup;
- filtering/normalization;
- connector startup baseline does not treat already-present DOM comments as new;
- TTS formatting must be exactly `Tên khách: comment` without source/platform prefix;
- SSML/XML escaping of untrusted spoken text;
- IPC sender/payload validation for playback completion;
- recent-comment display preserves usernames containing `:`.

Connector runtime verification against real live pages remains mandatory because selectors/network behavior are platform-owned and can change independently of the repository.

## Explicitly out of scope

- SaaS / cloud backend
- app user accounts / multi-tenant
- database / Redis / message broker
- analytics/history database
- AI classification/reply/product recognition/order automation
- OBS overlay
- mobile/macOS/Linux releases
- multiple TikTok lives
- multiple Shopee lives
- multiple Facebook browser accounts
- multiple platform modes at the same time
- CAPTCHA bypass, proxy rotation, bot evasion
- official APIs unless needed to unblock the simplest viable capture route

## Definition of done

The current Facebook/TikTok implementation milestone is done only when:

- Facebook and TikTok capture routes are proven on real live pages;
- core tests pass;
- implemented TTS is sequential and uses the exact spoken format;
- stale/bounded queue behavior is verified;
- security boundaries for remote/untrusted pages, comment input, SSML output, and playback IPC are reviewed;
- docs describe the current implementation and verification truth.

The full three-platform MVP additionally requires:

- Shopee capture proven on a real live page;
- Facebook working from 1 live through the agreed multi-live limit;
- TikTok working for one live;
- Shopee working for one live;
- Windows runtime verification for the completed operator workflow;
- final packaging/distribution verification.
