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
- URL allowlist/source-window security tests;
- `package-lock.json`;
- GitHub Actions CI chạy `npm ci` + `npm run typecheck` + `npm test` + `npm run build` trên Windows và Ubuntu với Node 24;
- spec, plan, agent rules, architecture decision, feasibility runbook và capture-evidence template.

**Chưa có:** parser comment thật, queue TTS hoàn chỉnh, Facebook multi-live, Windows installer.

Đây là chủ ý của spec: phải chứng minh được cách bắt **một comment thật** trên cả Facebook, TikTok và Shopee trước khi build phần còn lại.

## Tài liệu project

| File | Mục đích |
|---|---|
| `AGENTS.md` | Quy tắc cho coding agent: scope, hard gate, security và verification honesty |
| `docs/specs/live-comment-tts-mvp.md` | Product/technical contract đã chốt |
| `docs/adr/0001-electron-local-browser-capture.md` | Lý do chọn Electron local + browser capture và các trade-off |
| `docs/runbooks/feasibility-harness.md` | Hướng dẫn chạy harness trên Windows GUI, chuẩn bị account và chứng minh comment thật |
| `tasks/plan.md` | Implementation plan theo dependency/risk-first |
| `tasks/todo.md` | Checklist trạng thái hiện tại |
| `tasks/capture-findings.md` | Template ghi bằng chứng runtime Facebook/TikTok/Shopee |

Nếu chỉ muốn tiếp tục phase hiện tại, đọc theo thứ tự:

```text
AGENTS.md
  ↓
docs/runbooks/feasibility-harness.md
  ↓
tasks/capture-findings.md
```

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

CI dùng Node.js 24. Dùng Node 24 cho development để khớp môi trường CI hiện tại.

Clone và checkout branch đang triển khai:

```bash
git clone https://github.com/nguyentuanson27-netizen/-c-cmt-live.git
cd ./-c-cmt-live
git checkout feat/mvp-live-comment-tts
```

Cài dependency từ lockfile và kiểm tra:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

`npm run dev` build TypeScript rồi mở Electron app.

## Cách dùng feasibility harness

Chi tiết đầy đủ nằm ở `docs/runbooks/feasibility-harness.md`.

Flow ngắn:

1. Chạy `npm run dev`.
2. Chọn Facebook, TikTok hoặc Shopee.
3. Dán URL livestream HTTPS của đúng platform.
4. Bấm **Mở source**.
5. Login thủ công trong source window nếu session chưa đăng nhập.
6. Bấm **Mở DevTools**.
7. Từ account viewer khác gửi comment marker rõ ràng.
8. Inspect DOM trước; chỉ inspect network/WebSocket nếu DOM không khả thi.
9. Chứng minh lấy được đúng `username + text` từ comment thật.
10. Ghi evidence vào `tasks/capture-findings.md`.

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
├─ .github/
│  └─ workflows/ci.yml
├─ AGENTS.md
├─ README.md
├─ docs/
│  ├─ adr/
│  │  └─ 0001-electron-local-browser-capture.md
│  ├─ runbooks/
│  │  └─ feasibility-harness.md
│  └─ specs/
│     └─ live-comment-tts-mvp.md
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
├─ tests/
│  ├─ platform-url.test.ts
│  └─ source-window.test.ts
├─ package.json
└─ package-lock.json
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

Chi tiết xem `tasks/plan.md` và `tasks/todo.md`.

## Verification status

**Verified by current GitHub Actions CI:**

Trên cả `windows-latest` và `ubuntu-latest` với Node 24:

- `npm ci` passes;
- `npm run typecheck` passes;
- `npm test` passes;
- `npm run build` passes.

**Also performed during the initial scaffold:**

- transpile/syntax check source TypeScript with semantic checking disabled;
- `node --check` on emitted JavaScript;
- manual assertions for platform URL allowlist/lookalike-host rejection.

**Not yet verified:**

- Electron GUI runtime;
- persistent authenticated session behavior on real platform pages;
- authenticated Facebook/TikTok/Shopee live runtime;
- real comment capture.

Do not treat the capture gate or MVP as complete until the runtime checks above pass and platform evidence is recorded in `tasks/capture-findings.md`.

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
