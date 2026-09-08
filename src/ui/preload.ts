import { contextBridge, ipcRenderer } from "electron";
import type { Platform } from "../platform";

export type SourceStatus = {
  level: "info" | "error";
  message: string;
};

contextBridge.exposeInMainWorld("liveCommentTts", {
  openSource: (platform: Platform, url: string) => ipcRenderer.invoke("source:open", { platform, url }),
  closeSource: () => ipcRenderer.invoke("source:close"),
  openDevTools: () => ipcRenderer.invoke("source:devtools"),
  onSourceStatus: (callback: (status: SourceStatus) => void) => {
    const listener = (_event: unknown, status: SourceStatus) => callback(status);
    ipcRenderer.on("source:status", listener);
    return () => ipcRenderer.removeListener("source:status", listener);
  },
});
