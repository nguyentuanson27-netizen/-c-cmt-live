import type { Platform } from "../platform";
import type { SourceStatus } from "./preload";

type LiveCommentTtsApi = {
  openSource(platform: Platform, url: string): Promise<{ ok: boolean; error?: string }>;
  closeSource(): Promise<{ ok: boolean }>;
  openDevTools(): Promise<{ ok: boolean; error?: string }>;
  onSourceStatus(callback: (status: SourceStatus) => void): () => void;
};

declare global {
  interface Window {
    liveCommentTts: LiveCommentTtsApi;
  }
}

const platformSelect = document.querySelector<HTMLSelectElement>("#platform");
const liveUrlInput = document.querySelector<HTMLInputElement>("#live-url");
const openButton = document.querySelector<HTMLButtonElement>("#open-source");
const closeButton = document.querySelector<HTMLButtonElement>("#close-source");
const devToolsButton = document.querySelector<HTMLButtonElement>("#open-devtools");
const statusElement = document.querySelector<HTMLElement>("#status");

if (!platformSelect || !liveUrlInput || !openButton || !closeButton || !devToolsButton || !statusElement) {
  throw new Error("Feasibility harness UI is missing required elements");
}

const statusOutput = statusElement;

function setStatus(message: string, level: SourceStatus["level"] = "info"): void {
  statusOutput.textContent = message;
  statusOutput.dataset.level = level;
}

openButton.addEventListener("click", async () => {
  const platform = platformSelect.value as Platform;
  const url = liveUrlInput.value.trim();

  if (!url) {
    setStatus("Nhập URL livestream trước khi mở.", "error");
    return;
  }

  const result = await window.liveCommentTts.openSource(platform, url);
  if (!result.ok) {
    setStatus(result.error ?? "Không mở được source window.", "error");
  }
});

closeButton.addEventListener("click", async () => {
  await window.liveCommentTts.closeSource();
});

devToolsButton.addEventListener("click", async () => {
  const result = await window.liveCommentTts.openDevTools();
  if (!result.ok) {
    setStatus(result.error ?? "Không mở được DevTools.", "error");
  }
});

window.liveCommentTts.onSourceStatus((status) => {
  setStatus(status.message, status.level);
});
