import path from "node:path";
import { BrowserWindow, session } from "electron";
import type { Platform } from "../platform";
import { isAllowedPlatformUrl, parsePlatformUrl } from "../security/platform-url";

export type SourceWindow = {
  platform: Platform;
  window: BrowserWindow;
};

function preloadPath(platform: Platform): string {
  return path.join(__dirname, "..", "connectors", platform, "preload.js");
}

export function createSourceWindow(platform: Platform, inputUrl: string): SourceWindow {
  const url = parsePlatformUrl(inputUrl, platform);
  const partition = `persist:${platform}`;
  const sourceSession = session.fromPartition(partition);

  sourceSession.setPermissionCheckHandler(() => false);

  sourceSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  const window = new BrowserWindow({
    width: 1200,
    height: 900,
    show: true,
    title: `Live Comment TTS — ${platform}`,
    webPreferences: {
      partition,
      preload: preloadPath(platform),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.webContents.setAudioMuted(true);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  window.webContents.on("will-navigate", (event, navigationUrl) => {
    if (!isAllowedPlatformUrl(navigationUrl, platform)) {
      event.preventDefault();
    }
  });

  window.webContents.on("will-redirect", (event, navigationUrl) => {
    if (!isAllowedPlatformUrl(navigationUrl, platform)) {
      event.preventDefault();
    }
  });

  void window.loadURL(url.href);

  return { platform, window };
}
