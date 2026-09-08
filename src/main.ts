import path from "node:path";
import { app, BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import { isPlatform, type Platform } from "./platform";
import { isAllowedPlatformUrl } from "./security/platform-url";
import { createSourceWindow, type SourceWindow } from "./windows/source-window";

app.enableSandbox();

let mainWindow: BrowserWindow | null = null;
let activeSource: SourceWindow | null = null;

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
      }
      emitStatus("Source window đã đóng.");
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

app.whenReady().then(() => {
  mainWindow = createMainWindow();

  mainWindow.on("closed", () => {
    closeActiveSource();
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
