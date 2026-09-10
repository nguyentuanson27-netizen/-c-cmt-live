import type { Platform } from "../platform";
import type { AcceptedCommentPayload, PlayAudioPayload, SourceStatus, TtsStatusPayload } from "./preload";

type LiveCommentTtsApi = {
  openSource(platform: Platform, url: string): Promise<{ ok: boolean; error?: string }>;
  closeSource(): Promise<{ ok: boolean }>;
  openDevTools(): Promise<{ ok: boolean; error?: string }>;
  onSourceStatus(callback: (status: SourceStatus) => void): () => void;
  onCommentAccepted(callback: (comment: AcceptedCommentPayload) => void): () => void;
  onPlayAudio(callback: (payload: PlayAudioPayload) => void): () => void;
  sendPlaybackFinished(id: string, success: boolean, error?: string): void;
  toggleTts(): Promise<{ ok: boolean; isPaused: boolean }>;
  clearQueue(): Promise<{ ok: boolean }>;
  onTtsStatus(callback: (status: TtsStatusPayload) => void): () => void;
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

const toggleTtsButton = document.querySelector<HTMLButtonElement>("#toggle-tts");
const clearQueueButton = document.querySelector<HTMLButtonElement>("#clear-queue");
const ttsStatusElement = document.querySelector<HTMLElement>("#tts-status");
const currentSpeakingElement = document.querySelector<HTMLElement>("#current-speaking");
const recentCommentsElement = document.querySelector<HTMLElement>("#recent-comments");

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

window.liveCommentTts.onCommentAccepted((comment) => {
  addRecentComment(comment);
});

let currentAudio: HTMLAudioElement | null = null;

window.liveCommentTts.onPlayAudio((payload) => {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    const audio = new Audio(`data:audio/mp3;base64,${payload.audioBase64}`);
    currentAudio = audio;

    audio.onended = () => {
      currentAudio = null;
      window.liveCommentTts.sendPlaybackFinished(payload.id, true);
    };

    audio.onerror = () => {
      currentAudio = null;
      window.liveCommentTts.sendPlaybackFinished(payload.id, false, "Audio playback error");
    };

    audio.play().catch((err: Error) => {
      currentAudio = null;
      window.liveCommentTts.sendPlaybackFinished(payload.id, false, err.message);
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Playback exception";
    window.liveCommentTts.sendPlaybackFinished(payload.id, false, msg);
  }
});

if (toggleTtsButton) {
  toggleTtsButton.addEventListener("click", async () => {
    const res = await window.liveCommentTts.toggleTts();
    if (res.ok) {
      toggleTtsButton.textContent = res.isPaused ? "Tiếp tục đọc" : "Tạm dừng đọc";
    }
  });
}

if (clearQueueButton) {
  clearQueueButton.addEventListener("click", async () => {
    await window.liveCommentTts.clearQueue();
  });
}

window.liveCommentTts.onTtsStatus((status) => {
  if (ttsStatusElement) {
    const stateText = status.isPaused ? "Đang tạm dừng" : "Đang bật";
    ttsStatusElement.innerHTML = `Trạng thái: <strong>${stateText}</strong> | Hàng đợi: <strong>${status.queueSize}</strong> bình luận`;
  }
  if (toggleTtsButton) {
    toggleTtsButton.textContent = status.isPaused ? "Tiếp tục đọc" : "Tạm dừng đọc";
  }
  if (currentSpeakingElement) {
    currentSpeakingElement.textContent = status.currentSpeaking ? status.currentSpeaking : "Chưa có";
  }
});

function addRecentComment(comment: AcceptedCommentPayload): void {
  if (!recentCommentsElement) {
    return;
  }

  const firstPlaceholder = recentCommentsElement.querySelector("p");
  if (firstPlaceholder && firstPlaceholder.textContent?.includes("Chưa có")) {
    recentCommentsElement.innerHTML = "";
  }

  const item = document.createElement("div");
  item.className = "comment-item";

  const badge = document.createElement("span");
  badge.className = "comment-platform-badge";
  badge.textContent = comment.platform.toUpperCase();

  const author = document.createElement("span");
  author.className = "comment-author";
  author.textContent = `${comment.username}: `;

  const content = document.createElement("span");
  content.textContent = comment.text;

  item.appendChild(badge);
  item.appendChild(author);
  item.appendChild(content);

  recentCommentsElement.prepend(item);

  while (recentCommentsElement.children.length > 50) {
    recentCommentsElement.removeChild(recentCommentsElement.lastChild!);
  }
}
