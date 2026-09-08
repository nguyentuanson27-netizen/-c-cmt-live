import { ipcRenderer } from "electron";

const platform = "tiktok" as const;

window.addEventListener("DOMContentLoaded", () => {
  ipcRenderer.send("source:ready", {
    platform,
    url: window.location.href,
    title: document.title,
  });
});
