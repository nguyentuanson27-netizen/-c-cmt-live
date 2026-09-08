# Live Comment TTS

Ứng dụng Windows nội bộ để đọc comment livestream bằng TTS tiếng Việt cho:

- Facebook Live
- TikTok Live
- Shopee Live

Mục tiêu của project là **chạy được, dễ sửa, không over-engineer**. Đây không phải SaaS và không xây backend/database nếu MVP chưa cần.

## Trạng thái hiện tại

Repository đang ở **feasibility phase**.

Đã có:

- Electron + TypeScript scaffold;
- local feasibility UI;
- mở một source window theo Facebook/TikTok/Shopee;
- persistent browser session theo platform;
- remote window sandboxed, Node integration tắt, context isolation bật;
- livestream audio bị mute;
- platform URL allowlist;
- unexpected popup/new-window bị chặn;
- nút mở DevTools để inspect live page hiện tại;
- test cho URL allowlist.

**Chưa có:** parser comment thật, queue TTS hoàn chỉnh, Facebook multi-live, Windows installer.

Đây là chủ ý của spec: phải chứng minh được cách bắt **một comment thật** trên cả Facebook, TikTok và Shopee trước khi build phần còn lại.

## MVP contract

### Facebook

- 1 Facebook browser session;
- tối đa 9 Facebook Live cùng lúc sau khi feasibility gate pass;
- comment từ các live được gom vào 1 queue chung;
- Page name chỉ hiện ở UI/log, không đọc bằng TTS.

### TikTok

- 1 account/session;
- 1 live tại một thời điểm.

### Shopee

- 1 account/session;
- 1 live tại một thời điểm.

### Format TTS

```text
Tên khách: nội dung comment
```

Không đọc platform name hoặc Facebook Page name.

## Architecture mục tiêu

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

## Tech stack hiện tại

- Electron `44.2.0`
- TypeScript `7.0.2`
- Vitest `5.0.0`
- vanilla HTML/CSS/TypeScript

`msedge-tts` sẽ chỉ được thêm ở TTS task sau khi capture gate pass.

## Quick start

Khuyến nghị Node.js 24.x cho môi trường development.

```bash
npm install
npm run typecheck
npm test
npm run dev
```

`npm run dev` build TypeScript rồi mở Electron app.

> Repository hiện chưa có `package-lock.json` vì dependency install chưa được chạy trong môi trường có npm registry access. Sau lần `npm install` đầu tiên, lockfile cần được review và commit trước khi coi dependency set là ship-ready.

## Cách dùng feasibility harness

1. Chạy `npm run dev`.
2. Chọn Facebook, TikTok hoặc Shopee.
3. Dán URL livestream HTTPS của đúng platform.
4. Bấm **Mở source**.
5. Login thủ công trong source window nếu session chưa đăng nhập.
6. Bấm **Mở DevTools**.
7. Inspect DOM/network của live page hiện tại để xác định cách lấy một comment mới gồm:
   - `username`
   - `text`
8. Chỉ sau khi capture route của cả 3 platform được chứng minh mới tiếp tục queue/TTS/app UI đầy đủ.

Không đoán selector từ memory và không copy selector cũ chỉ vì nó từng hoạt động.

## Browser/session behavior

Persistent partitions:

```text
persist:facebook
persist:tiktok
persist:shopee
```

Remote source windows:

```ts
{
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true
}
```

Ngoài ra source window:

- chỉ nhận URL HTTPS thuộc domain platform tương ứng;
- mute audio của livestream;
- deny browser permission requests trong feasibility harness;
- deny popup/new-window;
- chặn navigation/redirect sang hostname ngoài platform;
- preload chỉ gửi heartbeat nhỏ về main process, chưa expose API cho remote page.

Lưu ý: popup SSO bên thứ ba có thể bị chặn bởi thiết kế này. Trong MVP ưu tiên login trực tiếp/QR trong cùng platform window; chỉ nới policy nếu runtime test chứng minh login thực tế cần nó.

## Project structure

```text
.
├─ docs/
│  └─ specs/live-comment-tts-mvp.md
├─ tasks/
│  ├─ plan.md
│  └─ todo.md
├─ public/
│  ├─ index.html
│  └─ app.css
├─ src/
│  ├─ main.ts
│  ├─ platform.ts
│  ├─ security/
│  │  └─ platform-url.ts
│  ├─ windows/
│  │  └─ source-window.ts
│  ├─ ui/
│  │  ├─ preload.ts
│  │  └─ renderer.ts
│  └─ connectors/
│     ├─ facebook/preload.ts
│     ├─ tiktok/preload.ts
│     └─ shopee/preload.ts
└─ tests/
   └─ platform-url.test.ts
```

## Plan

Implementation order:

```text
repo/docs
  ↓
Electron feasibility harness
  ↓
Facebook capture spike
  ↓
TikTok capture spike
  ↓
Shopee capture spike
  ↓
HARD GATE
  ↓
core queue/filter/dedup
  ↓
TTS
  ↓
Facebook multi-live + TikTok/Shopee integration
  ↓
minimal operator UI/config
  ↓
Windows verification/package
```

Chi tiết xem:

- `docs/specs/live-comment-tts-mvp.md`
- `tasks/plan.md`
- `tasks/todo.md`

## Verification status

Đã thực hiện trong quá trình scaffold:

- transpile/syntax check source TypeScript bằng compiler có sẵn trong execution environment với semantic checking disabled;
- `node --check` trên JavaScript đã emit;
- manual assertions cho platform URL allowlist/lookalike-host rejection.

Chưa thực hiện được trong execution environment hiện tại:

- `npm install`;
- repository `npm test`;
- repository `npm run typecheck` với Electron/Vitest dependencies thực tế;
- Electron GUI runtime;
- authenticated Facebook/TikTok/Shopee live runtime;
- real comment capture.

Không coi capture gate hoặc MVP là hoàn thành cho tới khi các runtime check tương ứng pass.

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

Platform-specific code phải nằm trong `src/connectors/<platform>/` càng nhiều càng tốt. Khi Facebook/TikTok/Shopee đổi DOM/network behavior, mục tiêu là sửa connector tương ứng thay vì sửa queue/TTS/core.
