# Live Comment TTS

Ứng dụng Windows nội bộ để đọc comment livestream bằng TTS tiếng Việt cho:

- Facebook Live
- TikTok Live
- Shopee Live (đang deferred)

Mục tiêu của project là **chạy được, dễ sửa, không over-engineer**. Đây không phải SaaS và không xây backend/database nếu MVP chưa cần.

## Trạng thái hiện tại

Repository đã qua feasibility cho **Facebook + TikTok** và đang ở giai đoạn **core/TTS + platform integration**.

Đã có:

- Electron + TypeScript scaffold;
- persistent browser session theo platform;
- source BrowserWindow sandboxed, `nodeIntegration: false`, `contextIsolation: true`;
- livestream audio bị mute;
- platform URL allowlist và popup/navigation restrictions;
- Facebook real-comment parser/capture đã có runtime evidence;
- TikTok real-comment parser/capture đã có runtime evidence;
- startup baseline để comment đã có sẵn trong DOM không bị coi là comment mới;
- core normalize/filter/dedup/bounded FIFO queue + stale skip;
- `msedge-tts` với voice mặc định `vi-VN-HoaiMyNeural`;
- sequential playback, retry một lần rồi skip khi lỗi;
- XML/SSML escaping cho comment text trước khi gửi vào TTS library;
- playback-completion IPC kiểm tra sender, playback id và payload shape;
- TTS status, pause/resume, clear queue và recent comment view;
- recent comment UI nhận structured payload, không parse lại status string;
- `package-lock.json`;
- GitHub Actions CI chạy `npm ci` + typecheck + tests + build trên Windows và Ubuntu với Node 24.

Chưa hoàn tất:

- Facebook manager cho 1–9 live đồng thời;
- Shopee real-comment capture/integration (deferred theo scope amendment ngày 2026-09-10);
- local JSON config cho operator settings;
- final Windows runtime verification/packaging.

Shopee deferred **không block** shared core/TTS hoặc Facebook/TikTok work, nhưng full three-platform MVP chưa được coi là hoàn thành cho đến khi Shopee được prove và integrate end-to-end.

## Tài liệu project

| File | Mục đích |
|---|---|
| `AGENTS.md` | Quy tắc cho coding agent: scope, gates, security và verification honesty |
| `docs/specs/live-comment-tts-mvp.md` | Product/technical contract và scope amendment hiện tại |
| `docs/adr/0001-electron-local-browser-capture.md` | Lý do chọn Electron local + browser capture |
| `docs/runbooks/feasibility-harness.md` | Hướng dẫn runtime capture verification |
| `tasks/plan.md` | Implementation plan theo dependency/risk-first |
| `tasks/todo.md` | Checklist trạng thái hiện tại |
| `tasks/capture-findings.md` | Runtime evidence cho từng platform |

## MVP contract

### Facebook

- 1 Facebook browser session;
- tối đa 9 Facebook Live cùng lúc ở phase multi-live;
- comment từ các live được gom vào 1 queue chung;
- Page/source label chỉ dùng ở UI/log, không đọc bằng TTS.

### TikTok

- 1 account/session;
- 1 live tại một thời điểm.

### Shopee

- 1 account/session;
- 1 live tại một thời điểm;
- capture/integration hiện deferred và sẽ được resume trước full three-platform completion.

### Format TTS

```text
Tên khách: nội dung comment
```

Không đọc platform name hoặc Facebook Page name.

## Architecture

```text
Remote live page(s)
      ↓
platform preload/parser
      ↓
Comment
      ↓
normalize → dedup → filter → stale check
      ↓
bounded FIFO queue (max 30)
      ↓
Edge TTS
      ↓
local audio playback
```

MVP không dùng:

- backend server;
- database;
- Redis/message broker;
- microservices;
- Playwright/Puppeteer/Selenium;
- generic plugin framework.

## Tech stack

- Electron `44.2.0`
- TypeScript `7.0.2`
- Vitest `5.0.0`
- `msedge-tts` `2.0.7`
- vanilla HTML/CSS/TypeScript

## Quick start

CI dùng Node.js 24. Dùng Node 24 cho development để khớp môi trường CI.

```bash
git clone https://github.com/nguyentuanson27-netizen/-c-cmt-live.git
cd ./-c-cmt-live
git checkout feat/mvp-live-comment-tts
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

`npm run dev` build TypeScript rồi mở Electron app.

## Capture behavior

Facebook và TikTok connector dùng DOM boundary đã được ghi lại trong `tasks/capture-findings.md`.

Khi connector khởi động, các comment đang tồn tại trong DOM được đưa vào baseline dedup state nhưng **không emit** vào pipeline. Chỉ comment mới xuất hiện sau baseline mới được gửi về Electron main process.

Platform-specific selectors/network behavior vẫn phải được runtime-verify khi platform thay đổi; unit test không thay thế real-live verification.

## Browser/session security

Persistent partitions:

```text
persist:facebook
persist:tiktok
persist:shopee
```

Remote source windows giữ các boundary tối thiểu:

```ts
{
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
}
```

Ngoài ra source window:

- chỉ nhận URL HTTPS thuộc domain platform tương ứng;
- mute audio livestream;
- deny permission requests theo policy hiện tại;
- deny unexpected popup/new-window;
- chặn navigation/redirect sang hostname ngoài platform;
- remote preload chỉ gửi payload tối thiểu qua IPC.

Main process validate sender/platform/URL/payload trước khi nhận comment. Playback completion từ renderer cũng validate sender, expected playback id và boolean `success` trước khi advance queue.

Comment text là untrusted input. Spoken string vẫn có format `username: text`, nhưng XML-sensitive characters được escape ngay trước khi text được đưa vào SSML envelope của `msedge-tts`.

## Project structure

```text
.
├─ .github/workflows/ci.yml
├─ AGENTS.md
├─ README.md
├─ docs/
│  ├─ adr/0001-electron-local-browser-capture.md
│  ├─ runbooks/feasibility-harness.md
│  └─ specs/live-comment-tts-mvp.md
├─ tasks/
│  ├─ capture-findings.md
│  ├─ plan.md
│  └─ todo.md
├─ public/
│  ├─ index.html
│  └─ app.css
├─ src/
│  ├─ main.ts
│  ├─ platform.ts
│  ├─ core/
│  │  ├─ comment.ts
│  │  ├─ dedup.ts
│  │  ├─ filter.ts
│  │  └─ queue.ts
│  ├─ security/
│  │  ├─ ipc.ts
│  │  └─ platform-url.ts
│  ├─ tts/
│  │  ├─ playback-manager.ts
│  │  └─ tts-service.ts
│  ├─ ui/
│  │  ├─ preload.ts
│  │  ├─ recent-comment.ts
│  │  └─ renderer.ts
│  ├─ windows/source-window.ts
│  └─ connectors/
│     ├─ comment-tracker.ts
│     ├─ facebook/preload.ts
│     ├─ tiktok/preload.ts
│     └─ shopee/preload.ts
├─ tests/
└─ package.json
```

## Implementation order

```text
repo/docs
  ↓
Electron feasibility harness
  ↓
Facebook + TikTok capture PASS
  ↓
CURRENT GATE
  ↓
core queue/filter/dedup
  ↓
TTS + secure sequential playback
  ↓
Facebook multi-live + TikTok final integration

Shopee capture (deferred)
  ↓
Shopee final integration
  ↓
full three-platform Windows verification/package
```

Chi tiết xem `tasks/plan.md` và `tasks/todo.md`.

## Verification status

Runtime evidence hiện có trong repository:

- Facebook real live capture: PASS;
- TikTok real live capture: PASS;
- Shopee capture: DEFERRED / chưa test.

GitHub Actions của các head đã verify `npm ci`, `npm run typecheck`, `npm test`, và `npm run build` trên Windows/Ubuntu. Mỗi thay đổi mới vẫn phải chờ CI của chính head đó trước khi coi repository checks là verified.

Các mục vẫn cần runtime verification ở phase tiếp theo:

- startup-baseline behavior trên real Facebook/TikTok live sau fix hiện tại;
- sequential TTS playback trên fixed head;
- Facebook 2 → 9 concurrent lives;
- Shopee capture + end-to-end integration;
- background/minimized source behavior;
- final Windows packaging workflow.

## Out of scope MVP

- SaaS/cloud backend
- app user accounts/multi-tenant
- database/analytics history
- AI classification/auto reply/order automation
- OBS overlay
- multiple TikTok lives
- multiple Shopee lives
- multiple Facebook browser accounts
- multiple platform modes cùng lúc
- CAPTCHA bypass/proxy rotation/bot evasion
- official APIs trừ khi cần để unblock cách capture đơn giản nhất

## Platform maintenance principle

Platform-specific capture code phải nằm trong `src/connectors/<platform>/` càng nhiều càng tốt. Khi Facebook/TikTok/Shopee đổi DOM/network behavior, mục tiêu là sửa connector tương ứng thay vì sửa queue/TTS/core.
