# ADR 0001 — Electron local browser capture for MVP

**Status:** Accepted

**Date:** 2026-09-10

## Context

The MVP is an internal Windows tool for fewer than 10 shops. It must read livestream comments aloud from Facebook Live, TikTok Live, and Shopee Live.

The operating contract is intentionally small:

- only one platform mode is active at a time;
- Facebook may monitor up to 9 live pages concurrently using one Facebook browser session;
- TikTok supports one account/session and one live;
- Shopee supports one account/session and one live;
- spoken output is only `Tên khách: nội dung comment`;
- official platform APIs are not required if a simpler browser route works;
- simplicity and ease of maintenance are more important than SaaS-scale architecture.

The largest technical uncertainty is not TTS or queueing. It is whether each current platform page exposes a stable-enough boundary from which a real new comment can be captured.

## Decision

Use one local **Electron + TypeScript** application.

Electron source `BrowserWindow`s will:

- open the current Facebook/TikTok/Shopee live page;
- keep login state in persistent platform partitions;
- let the operator login manually;
- run a small platform-specific preload/parser;
- mute livestream audio;
- send only validated comment data back to the main process.

The preferred capture order is:

1. current DOM observation;
2. page network/WebSocket boundary only if DOM capture is proven non-viable;
3. another connector/API only if the previous simpler routes are insufficient.

Before the complete queue/TTS/multi-live app is implemented, a hard feasibility gate requires one real `username + text` capture from each platform.

## Why this decision

This keeps the MVP to one runtime and one language while still providing:

- persistent browser sessions;
- access to the current authenticated live page;
- a controlled preload boundary;
- a direct path to multi-window Facebook support later;
- easy inspection when a platform changes its DOM/network behavior.

It also avoids building a server or protocol integration before the real capture boundary is known.

## Alternatives considered

### Official platform APIs

Not selected as the default MVP path because API approval, permissions, auth flows, or product availability can add work unrelated to the internal use case. They remain a fallback if they become the simplest viable route for a platform.

### Playwright / Puppeteer / Selenium

Not selected because Electron already provides the browser runtime needed by the desktop app. Adding a second browser-automation runtime would duplicate responsibility without an observed need.

### Fork a large multistream project

Not selected as the starting point because the MVP needs only three platform connectors, one queue, and TTS. A large fork would increase code and maintenance surface. Existing projects may still be used as implementation references.

### Backend service + web UI

Not selected. The app is internal/local, uses browser login state, and does not need multi-tenant or remote operation.

## Consequences

### Positive

- small architecture;
- no backend/database infrastructure;
- platform changes are isolated primarily to connector code;
- login remains manual and local;
- Facebook can later scale from one proven source to several windows without redesigning the whole app.

### Negative / accepted risks

- platform DOM/network changes can break capture;
- multiple Facebook live pages can consume significant RAM/CPU;
- browser/login behavior may require small platform-specific exceptions;
- `msedge-tts`, once added, is another external dependency that can change.

These are accepted for the internal MVP. Do not pre-build fallback systems for them.

## Security boundary

Remote live pages are untrusted. Source windows must keep Node integration disabled, context isolation and sandbox enabled, use platform URL restrictions, mute source audio, block unexpected windows/navigation as appropriate, and validate IPC senders/payloads.

Passwords, OTPs, cookies, session tokens, authorization headers, and browser storage dumps must never be committed or written to normal logs.

## Revisit when

Create a new ADR instead of silently changing this one if any of these becomes true:

- the app must become SaaS or remotely operated;
- multiple independent Facebook accounts must run concurrently;
- DOM/network capture is not viable on a required platform;
- Electron resource usage is measured and unacceptable on target Windows machines;
- an official API becomes materially simpler and more reliable than browser capture.
