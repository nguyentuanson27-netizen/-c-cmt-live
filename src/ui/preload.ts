import { contextBridge, ipcRenderer } from "electron";
import type { Platform } from "../platform";

export type SourceStatus = {
  level: "info" | "error";
  message: string;
};

export type PlayAudioPayload = {
  id: string;
  audioBase64: string;
  text: string;
};

export type TtsStatusPayload = {
  queueSize: number;
  currentSpeaking?: string;
  isPaused: boolean;
};

export type AcceptedCommentPayload = {
  platform: Platform;
  sourceLabel?: string;
  username: string;
  text: string;
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
  onCommentAccepted: (callback: (comment: AcceptedCommentPayload) => void) => {
    const listener = (_event: unknown, comment: AcceptedCommentPayload) => callback(comment);
    ipcRenderer.on("comment:accepted", listener);
    return () => ipcRenderer.removeListener("comment:accepted", listener);
  },
  onPlayAudio: (callback: (payload: PlayAudioPayload) => void) => {
    const listener = (_event: unknown, payload: PlayAudioPayload) => callback(payload);
    ipcRenderer.on("tts:play", listener);
    return () => ipcRenderer.removeListener("tts:play", listener);
  },
  sendPlaybackFinished: (id: string, success: boolean, error?: string) => {
    ipcRenderer.send("tts:playback-finished", { id, success, error });
  },
  toggleTts: () => ipcRenderer.invoke("tts:toggle"),
  clearQueue: () => ipcRenderer.invoke("tts:clear-queue"),
  onTtsStatus: (callback: (status: TtsStatusPayload) => void) => {
    const listener = (_event: unknown, status: TtsStatusPayload) => callback(status);
    ipcRenderer.on("tts:status", listener);
    return () => ipcRenderer.removeListener("tts:status", listener);
  },
});
