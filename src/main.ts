import path from "node:path";
import { app, BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import { isPlatform, type Platform } from "./platform";
import { getTrustedPlaybackFinishedPayload } from "./security/ipc";
import { isAllowedPlatformUrl } from "./security/platform-url";
import { createSourceWindow, type SourceWindow } from "./windows/source-window";
import { preparePlatformSwitch } from "./windows/platform-switch";
import { FacebookSourceManager } from "./connectors/facebook/manager";
import { FacebookGraphApiConnector, type FacebookApiComment } from "./connectors/facebook/graph-api-connector";
import type { Comment } from "./core/comment";
import { normalizeComment } from "./core/filter";
import { CommentDedup } from "./core/dedup";
import { CommentQueue } from "./core/queue";
import { TTSService } from "./tts/tts-service";
import { PlaybackManager } from "./tts/playback-manager";

app.enableSandbox();

let mainWindow: BrowserWindow | null = null;
const facebookManager = new FacebookSourceManager();
const facebookGraphConnector = new FacebookGraphApiConnector();
let singleActiveSource: SourceWindow | null = null;

const commentDedup = new CommentDedup({ windowMs: 60_000 });
const commentQueue = new CommentQueue(30, 30_000);
const ttsService = new TTSService();

let isTtsPaused = false;
let currentSpeakingText = "";

function emitTtsStatus(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("tts:status", {
      queueSize: commentQueue.size(),
      currentSpeaking: currentSpeakingText || undefined,
      isPaused: isTtsPaused,
    });
  }
}

const playbackManager = new PlaybackManager(commentQueue, ttsService, {
  onSpeakStart: (_comment, text) => {
    currentSpeakingText = text;
    emitTtsStatus();
  },
  onSpeakEnd: () => {
    currentSpeakingText = "";
    emitTtsStatus();
  },
  onQueueUpdate: () => {
    emitTtsStatus();
  },
  playAudio: async (id, audioBase64) => {
    const targetWin = mainWindow;
    if (!targetWin || targetWin.isDestroyed()) {
      return { success: false };
    }

    return new Promise((resolve) => {
      const handler = (event: IpcMainEvent, payload: unknown) => {
        const completion = getTrustedPlaybackFinishedPayload(
          event.sender.id,
          targetWin.webContents.id,
          payload,
          id,
        );
        if (!completion) {
          return;
        }

        ipcMain.removeListener("tts:playback-finished", handler);
        clearTimeout(timeoutId);
        resolve({ success: completion.success });
      };

      const timeoutId = setTimeout(() => {
        ipcMain.removeListener("tts:playback-finished", handler);
        resolve({ success: false });
      }, 25_000);

      ipcMain.on("tts:playback-finished", handler);
      targetWin.webContents.send("tts:play", {
        id,
        audioBase64,
        text: currentSpeakingText,
      });
    });
  },
});

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 760,
    height: 560,
    minWidth: 640,
    minHeight: 480,
    title: "Live Comment TTS — Feasibility",
    webPreferences: {
      preload: path.join(__dirname, "ui", "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  void window.loadFile(path.join(__dirname, "..", "public", "index.html"));
  return window;
}

function isTrustedMainSender(event: IpcMainInvokeEvent): boolean {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && event.sender.id === mainWindow.webContents.id);
}

function emitStatus(message: string, level: "info" | "error" = "info"): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("source:status", { message, level });
  }
}

function emitApiStatus(message: string, level: "info" | "error" = "info"): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("api:facebook:status-changed", {
      active: facebookGraphConnector.isActive,
      liveVideoId: facebookGraphConnector.activeLiveVideoId,
      message,
      level,
    });
  }
}

function emitSourceList(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const list = [
      ...facebookManager.list().map((s) => ({
        id: s.id,
        platform: "facebook" as const,
        label: s.label,
        url: s.url,
      })),
      ...(singleActiveSource && !singleActiveSource.window.isDestroyed()
        ? [
            {
              id: String(singleActiveSource.window.id),
              platform: singleActiveSource.platform,
              label: singleActiveSource.platform.toUpperCase(),
              url: singleActiveSource.url,
            },
          ]
        : []),
    ];
    mainWindow.webContents.send("source:list", list);
  }
}

function closeSingleActiveSource(): void {
  if (singleActiveSource && !singleActiveSource.window.isDestroyed()) {
    singleActiveSource.window.close();
  }
  singleActiveSource = null;
}

function closeAllSources(): void {
  facebookGraphConnector.stop();
  facebookManager.closeAll();
  closeSingleActiveSource();
}

type ResolvedSource = {
  platform: Platform;
  sourceId: string;
  sourceLabel: string;
  window: BrowserWindow;
  url: string;
};

function resolveSourceBySenderId(senderId: number): ResolvedSource | null {
  const fb = facebookManager.findByWebContentsId(senderId);
  if (fb && !fb.source.window.isDestroyed()) {
    return {
      platform: "facebook",
      sourceId: fb.id,
      sourceLabel: fb.label,
      window: fb.source.window,
      url: fb.source.url,
    };
  }

  if (
    singleActiveSource &&
    !singleActiveSource.window.isDestroyed() &&
    singleActiveSource.window.webContents.id === senderId
  ) {
    return {
      platform: singleActiveSource.platform,
      sourceId: String(singleActiveSource.window.id),
      sourceLabel: singleActiveSource.platform,
      window: singleActiveSource.window,
      url: singleActiveSource.url,
    };
  }

  return null;
}

function extractSourceId(request: unknown): string | undefined {
  if (typeof request === "string") {
    return request;
  }
  if (request && typeof request === "object") {
    const id = (request as Record<string, unknown>).sourceId;
    if (typeof id === "string") {
      return id;
    }
  }
  return undefined;
}

function isOpenRequest(value: unknown): value is { platform: Platform; url: string } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const request = value as Record<string, unknown>;
  return isPlatform(request.platform) && typeof request.url === "string";
}

ipcMain.handle("source:open", async (event, request: unknown) => {
  if (!isTrustedMainSender(event)) {
    return { ok: false, error: "Untrusted IPC sender" };
  }

  if (!isOpenRequest(request)) {
    return { ok: false, error: "Invalid source request" };
  }

  try {
    preparePlatformSwitch(request.platform, {
      closeFacebookSources: () => facebookManager.closeAll(),
      closeSingleSource: () => closeSingleActiveSource(),
    });

    if (request.platform === "facebook") {
      const managed = facebookManager.open(request.url);

      managed.source.window.on("closed", () => {
        emitSourceList();
        emitStatus(`Source Facebook (${managed.id}) đã đóng.`);
      });

      emitStatus(`Đang mở Facebook (${managed.id})...`);
      emitSourceList();
      return { ok: true, sourceId: managed.id };
    } else {
      const source = createSourceWindow(request.platform, request.url);
      singleActiveSource = source;

      source.window.on("closed", () => {
        if (singleActiveSource?.window === source.window) {
          singleActiveSource = null;
          emitSourceList();
          emitStatus("Source window đã đóng.");
        }
      });

      emitStatus(`Đang mở ${request.platform}...`);
      emitSourceList();
      return { ok: true, sourceId: String(source.window.id) };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown source error";
    emitStatus(message, "error");
    return { ok: false, error: message };
  }
});

ipcMain.handle("source:close", async (event, request?: unknown) => {
  if (!isTrustedMainSender(event)) {
    return { ok: false };
  }

  const sourceId = extractSourceId(request);

  if (sourceId) {
    if (facebookManager.get(sourceId)) {
      facebookManager.close(sourceId);
      emitSourceList();
      emitStatus(`Source Facebook (${sourceId}) đã dừng.`);
      return { ok: true };
    }
    if (singleActiveSource && String(singleActiveSource.window.id) === sourceId) {
      closeSingleActiveSource();
      emitSourceList();
      emitStatus("Source window đã dừng.");
      return { ok: true };
    }
    return { ok: false, error: "Source không tồn tại" };
  }

  if (singleActiveSource) {
    closeSingleActiveSource();
    emitSourceList();
    emitStatus("Source window đã dừng.");
    return { ok: true };
  }

  if (facebookManager.count() > 0) {
    facebookManager.closeAll();
    emitSourceList();
    emitStatus("Tất cả Facebook sources đã đóng.");
    return { ok: true };
  }

  return { ok: true };
});

ipcMain.handle("source:devtools", async (event, request?: unknown) => {
  if (!isTrustedMainSender(event)) {
    return { ok: false, error: "Untrusted IPC sender" };
  }

  const sourceId = extractSourceId(request);

  if (sourceId) {
    const managed = facebookManager.get(sourceId);
    if (managed && !managed.source.window.isDestroyed()) {
      managed.source.window.webContents.openDevTools({ mode: "detach" });
      return { ok: true };
    }
    if (
      singleActiveSource &&
      !singleActiveSource.window.isDestroyed() &&
      String(singleActiveSource.window.id) === sourceId
    ) {
      singleActiveSource.window.webContents.openDevTools({ mode: "detach" });
      return { ok: true };
    }
    return { ok: false, error: "Source window không tìm thấy hoặc đã đóng." };
  }

  if (singleActiveSource && !singleActiveSource.window.isDestroyed()) {
    singleActiveSource.window.webContents.openDevTools({ mode: "detach" });
    return { ok: true };
  }

  const fbSources = facebookManager.list();
  if (fbSources.length > 0) {
    const last = fbSources[fbSources.length - 1];
    if (!last.source.window.isDestroyed()) {
      last.source.window.webContents.openDevTools({ mode: "detach" });
      return { ok: true };
    }
  }

  return { ok: false, error: "Chưa có source window đang mở." };
});

ipcMain.handle("tts:toggle", async (event) => {
  if (!isTrustedMainSender(event)) {
    return { ok: false, isPaused: isTtsPaused };
  }
  isTtsPaused = !isTtsPaused;
  playbackManager.setPaused(isTtsPaused);
  emitTtsStatus();
  return { ok: true, isPaused: isTtsPaused };
});

ipcMain.handle("tts:clear-queue", async (event) => {
  if (!isTrustedMainSender(event)) {
    return { ok: false };
  }
  commentQueue.clear();
  emitTtsStatus();
  return { ok: true };
});

function handleApiComment(apiComment: FacebookApiComment): void {
  const normalized = normalizeComment(apiComment.username, apiComment.text);
  if (!normalized) {
    return;
  }

  const sourceId = "facebook-graph-api";
  if (commentDedup.isDuplicate(sourceId, normalized.username, normalized.text)) {
    return;
  }
  commentDedup.record(sourceId, normalized.username, normalized.text);

  const item: Comment = {
    id: apiComment.id || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    platform: "facebook",
    sourceId,
    sourceLabel: "FB-API",
    username: normalized.username,
    text: normalized.text,
    receivedAt: apiComment.timestamp || Date.now(),
  };

  commentQueue.enqueue(item);
  emitTtsStatus();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("comment:accepted", {
      platform: item.platform,
      sourceLabel: item.sourceLabel,
      username: item.username,
      text: item.text,
    });
  }

  console.log(`[API COMMENT CAPTURED] [${item.sourceLabel}] ${normalized.username}: ${normalized.text}`);
  emitStatus(`[${item.sourceLabel}] ${normalized.username}: ${normalized.text}`);

  void playbackManager.processNext();
}

ipcMain.handle("api:facebook:start", async (event, config: unknown) => {
  if (!isTrustedMainSender(event)) {
    return { ok: false, error: "Untrusted IPC sender" };
  }

  if (!config || typeof config !== "object") {
    return { ok: false, error: "Cấu hình API không hợp lệ." };
  }

  const cfg = config as Record<string, unknown>;
  const token = typeof cfg.token === "string" ? cfg.token : "";
  const liveIdOrUrl = typeof cfg.liveIdOrUrl === "string" ? cfg.liveIdOrUrl : undefined;
  const pollIntervalMs = typeof cfg.pollIntervalMs === "number" ? cfg.pollIntervalMs : 1000;

  const res = await facebookGraphConnector.start(
    { token, liveVideoIdOrUrl: liveIdOrUrl, pollIntervalMs },
    {
      onComment: (c) => handleApiComment(c),
      onStatus: (msg, lvl) => emitApiStatus(msg, lvl),
    }
  );

  return res;
});

ipcMain.handle("api:facebook:stop", async (event) => {
  if (!isTrustedMainSender(event)) {
    return { ok: false };
  }

  facebookGraphConnector.stop();
  emitApiStatus("Đã dừng kết nối Graph API.", "info");
  return { ok: true };
});

ipcMain.handle("api:facebook:status", async (event) => {
  if (!isTrustedMainSender(event)) {
    return { active: false };
  }

  return {
    active: facebookGraphConnector.isActive,
    liveVideoId: facebookGraphConnector.activeLiveVideoId,
  };
});

ipcMain.on("source:ready", (event: IpcMainEvent, payload: unknown) => {
  const resolved = resolveSourceBySenderId(event.sender.id);
  if (!resolved) {
    return;
  }

  if (!payload || typeof payload !== "object") {
    return;
  }

  const ready = payload as Record<string, unknown>;
  if (
    ready.platform !== resolved.platform ||
    typeof ready.url !== "string" ||
    !isAllowedPlatformUrl(ready.url, resolved.platform)
  ) {
    return;
  }

  emitStatus(`[${resolved.sourceLabel}] source đã load. Mở DevTools để inspect comment DOM.`);
});

ipcMain.on("source:comment", (event: IpcMainEvent, payload: unknown) => {
  const resolved = resolveSourceBySenderId(event.sender.id);
  if (!resolved) {
    return;
  }

  if (!payload || typeof payload !== "object") {
    return;
  }

  const comment = payload as Record<string, unknown>;
  if (
    comment.platform !== resolved.platform ||
    typeof comment.username !== "string" ||
    typeof comment.text !== "string"
  ) {
    return;
  }

  const currentUrl = resolved.window.webContents.getURL();
  if (!isAllowedPlatformUrl(currentUrl, resolved.platform)) {
    return;
  }

  const normalized = normalizeComment(comment.username, comment.text);
  if (!normalized) {
    return;
  }

  if (commentDedup.isDuplicate(resolved.sourceId, normalized.username, normalized.text)) {
    return;
  }
  commentDedup.record(resolved.sourceId, normalized.username, normalized.text);

  const item: Comment = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    platform: resolved.platform,
    sourceId: resolved.sourceId,
    sourceLabel: resolved.sourceLabel,
    username: normalized.username,
    text: normalized.text,
    receivedAt: Date.now(),
  };

  commentQueue.enqueue(item);
  emitTtsStatus();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("comment:accepted", {
      platform: item.platform,
      sourceLabel: item.sourceLabel,
      username: item.username,
      text: item.text,
    });
  }

  console.log(`[REAL COMMENT CAPTURED] [${item.sourceLabel}] ${normalized.username}: ${normalized.text}`);
  emitStatus(`[${item.sourceLabel}] ${normalized.username}: ${normalized.text}`);

  void playbackManager.processNext();
});

app.whenReady().then(() => {
  mainWindow = createMainWindow();

  mainWindow.webContents.on("did-finish-load", () => {
    emitTtsStatus();
    emitSourceList();
  });

  mainWindow.on("closed", () => {
    closeAllSources();
    playbackManager.setPaused(true);
    commentQueue.clear();
    mainWindow = null;
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
