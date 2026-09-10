import path from "node:path";
import { app, BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import { isPlatform, type Platform } from "./platform";
import { isAllowedPlatformUrl } from "./security/platform-url";
import { createSourceWindow, type SourceWindow } from "./windows/source-window";
import type { Comment } from "./core/comment";
import { normalizeComment } from "./core/filter";
import { CommentDedup } from "./core/dedup";
import { CommentQueue } from "./core/queue";
import { TTSService } from "./tts/tts-service";
import { PlaybackManager } from "./tts/playback-manager";

app.enableSandbox();

let mainWindow: BrowserWindow | null = null;
let activeSource: SourceWindow | null = null;

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
      const handler = (_event: IpcMainEvent, payload: { id: string; success: boolean }) => {
        if (payload?.id === id) {
          ipcMain.removeListener("tts:playback-finished", handler);
          clearTimeout(timeoutId);
          resolve({ success: payload.success });
        }
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

function closeActiveSource(): void {
  if (activeSource && !activeSource.window.isDestroyed()) {
    activeSource.window.close();
  }
  activeSource = null;
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
    closeActiveSource();
    const source = createSourceWindow(request.platform, request.url);
    activeSource = source;

    source.window.on("closed", () => {
      if (activeSource?.window === source.window) {
        activeSource = null;
        emitStatus("Source window đã đóng.");
      }
    });

    emitStatus(`Đang mở ${request.platform}...`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown source error";
    emitStatus(message, "error");
    return { ok: false, error: message };
  }
});

ipcMain.handle("source:close", async (event) => {
  if (!isTrustedMainSender(event)) {
    return { ok: false };
  }

  closeActiveSource();
  emitStatus("Source window đã dừng.");
  return { ok: true };
});

ipcMain.handle("source:devtools", async (event) => {
  if (!isTrustedMainSender(event)) {
    return { ok: false, error: "Untrusted IPC sender" };
  }

  if (!activeSource || activeSource.window.isDestroyed()) {
    return { ok: false, error: "Chưa có source window đang mở." };
  }

  activeSource.window.webContents.openDevTools({ mode: "detach" });
  return { ok: true };
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

ipcMain.on("source:ready", (event: IpcMainEvent, payload: unknown) => {
  if (!activeSource || activeSource.window.isDestroyed()) {
    return;
  }

  if (event.sender.id !== activeSource.window.webContents.id) {
    return;
  }

  if (!payload || typeof payload !== "object") {
    return;
  }

  const ready = payload as Record<string, unknown>;
  if (
    ready.platform !== activeSource.platform ||
    typeof ready.url !== "string" ||
    !isAllowedPlatformUrl(ready.url, activeSource.platform)
  ) {
    return;
  }

  emitStatus(`${activeSource.platform} source đã load. Mở DevTools để inspect comment DOM.`);
});

ipcMain.on("source:comment", (event: IpcMainEvent, payload: unknown) => {
  if (!activeSource || activeSource.window.isDestroyed()) {
    return;
  }

  if (event.sender.id !== activeSource.window.webContents.id) {
    return;
  }

  if (!payload || typeof payload !== "object") {
    return;
  }

  const comment = payload as Record<string, unknown>;
  if (
    comment.platform !== activeSource.platform ||
    typeof comment.username !== "string" ||
    typeof comment.text !== "string"
  ) {
    return;
  }

  const currentUrl = activeSource.window.webContents.getURL();
  if (!isAllowedPlatformUrl(currentUrl, activeSource.platform)) {
    return;
  }

  // 1. Filter & Normalize
  const normalized = normalizeComment(comment.username, comment.text);
  if (!normalized) {
    return;
  }

  // 2. Deduplicate
  if (commentDedup.isDuplicate(normalized.username, normalized.text)) {
    return;
  }
  commentDedup.record(normalized.username, normalized.text);

  // 3. Enqueue
  const item: Comment = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    platform: activeSource.platform,
    sourceId: activeSource.window.id.toString(),
    sourceLabel: activeSource.platform,
    username: normalized.username,
    text: normalized.text,
    receivedAt: Date.now(),
  };

  commentQueue.enqueue(item);
  emitTtsStatus();

  console.log(`[REAL COMMENT CAPTURED] [${activeSource.platform}] ${normalized.username}: ${normalized.text}`);
  emitStatus(`[${activeSource.platform}] ${normalized.username}: ${normalized.text}`);

  // 4. Trigger playback
  void playbackManager.processNext();
});

app.whenReady().then(() => {
  mainWindow = createMainWindow();

  mainWindow.webContents.on("did-finish-load", () => {
    emitTtsStatus();
  });

  mainWindow.on("closed", () => {
    closeActiveSource();
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
