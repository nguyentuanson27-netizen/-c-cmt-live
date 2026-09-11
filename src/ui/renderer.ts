import type { Platform } from "../platform";
import type { AcceptedCommentPayload, PlayAudioPayload, SourceItem, SourceStatus, TtsStatusPayload } from "./preload";

type LiveCommentTtsApi = {
  openSource(platform: Platform, url: string): Promise<{ ok: boolean; sourceId?: string; error?: string }>;
  closeSource(sourceId?: string): Promise<{ ok: boolean }>;
  openDevTools(sourceId?: string): Promise<{ ok: boolean; error?: string }>;
  onSourceList(callback: (sources: SourceItem[]) => void): () => void;
  onSourceStatus(callback: (status: SourceStatus) => void): () => void;
  onCommentAccepted(callback: (comment: AcceptedCommentPayload) => void): () => void;
  onPlayAudio(callback: (payload: PlayAudioPayload) => void): () => void;
  sendPlaybackFinished(id: string, success: boolean, error?: string): void;
  toggleTts(): Promise<{ ok: boolean; isPaused: boolean }>;
  clearQueue(): Promise<{ ok: boolean }>;
  onTtsStatus(callback: (status: TtsStatusPayload) => void): () => void;
  startFacebookApi(config: { token: string; liveIdOrUrl?: string; pollIntervalMs?: number }): Promise<{ ok: boolean; liveVideoId?: string; error?: string }>;
  stopFacebookApi(): Promise<{ ok: boolean }>;
  getFacebookApiStatus(): Promise<{ active: boolean; liveVideoId?: string }>;
  onFacebookApiStatus(callback: (status: { active: boolean; liveVideoId?: string; message?: string; level?: "info" | "error" }) => void): () => void;
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
const sourcesListElement = document.querySelector<HTMLElement>("#sources-list");
const sourceCountElement = document.querySelector<HTMLElement>("#source-count");

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

window.liveCommentTts.onSourceList((sources) => {
  if (sourceCountElement) {
    sourceCountElement.textContent = String(sources.length);
  }
  if (!sourcesListElement) {
    return;
  }

  sourcesListElement.innerHTML = "";

  if (sources.length === 0) {
    const empty = document.createElement("p");
    empty.style.color = "#656d76";
    empty.style.fontSize = "0.9em";
    empty.textContent = "Chưa có source nào đang mở.";
    sourcesListElement.appendChild(empty);
    return;
  }

  for (const source of sources) {
    const row = document.createElement("div");
    row.className = "source-item";

    const info = document.createElement("div");
    info.className = "source-item-info";

    const badge = document.createElement("span");
    badge.className = "comment-platform-badge";
    badge.textContent = source.label;

    const urlSpan = document.createElement("span");
    urlSpan.className = "source-item-url";
    urlSpan.title = source.url;
    urlSpan.textContent = source.url;

    info.appendChild(badge);
    info.appendChild(urlSpan);

    const actions = document.createElement("div");
    actions.className = "source-item-actions";

    const dtBtn = document.createElement("button");
    dtBtn.type = "button";
    dtBtn.textContent = "DevTools";
    dtBtn.addEventListener("click", async () => {
      const res = await window.liveCommentTts.openDevTools(source.id);
      if (!res.ok) {
        setStatus(res.error ?? "Không mở được DevTools.", "error");
      }
    });

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "Đóng";
    closeBtn.addEventListener("click", async () => {
      await window.liveCommentTts.closeSource(source.id);
    });

    actions.appendChild(dtBtn);
    actions.appendChild(closeBtn);

    row.appendChild(info);
    row.appendChild(actions);

    sourcesListElement.appendChild(row);
  }
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
  badge.textContent = (comment.sourceLabel || comment.platform).toUpperCase();

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

// Facebook Page Graph API Controls
const startFbApiBtn = document.querySelector<HTMLButtonElement>("#start-fb-api");
const stopFbApiBtn = document.querySelector<HTMLButtonElement>("#stop-fb-api");
const fbTokenInput = document.querySelector<HTMLInputElement>("#fb-page-token");
const fbLiveIdInput = document.querySelector<HTMLInputElement>("#fb-live-id");
const fbApiStatusEl = document.querySelector<HTMLElement>("#fb-api-status");

if (startFbApiBtn && stopFbApiBtn && fbTokenInput && fbLiveIdInput) {
  const savedToken = localStorage.getItem("fb_page_token");
  if (savedToken) {
    fbTokenInput.value = savedToken;
  }

  startFbApiBtn.addEventListener("click", async () => {
    const token = fbTokenInput.value.trim();
    const liveIdOrUrl = fbLiveIdInput.value.trim();

    if (!token) {
      if (fbApiStatusEl) {
        fbApiStatusEl.innerHTML = `<span style="color: #cf222e; font-weight: 600;">Vui lòng dán Page Access Token.</span>`;
      }
      return;
    }

    localStorage.setItem("fb_page_token", token);

    if (fbApiStatusEl) {
      fbApiStatusEl.innerHTML = `<span style="color: #0969da;">Đang kết nối Facebook Graph API...</span>`;
    }
    startFbApiBtn.disabled = true;

    const res = await window.liveCommentTts.startFacebookApi({
      token,
      liveIdOrUrl: liveIdOrUrl || undefined,
    });

    if (!res.ok) {
      startFbApiBtn.disabled = false;
      stopFbApiBtn.disabled = true;
      if (fbApiStatusEl) {
        fbApiStatusEl.innerHTML = `<span style="color: #cf222e; font-weight: 600;">Lỗi: ${res.error || "Không thể kết nối"}</span>`;
      }
    } else {
      startFbApiBtn.disabled = true;
      stopFbApiBtn.disabled = false;
      if (fbApiStatusEl) {
        fbApiStatusEl.innerHTML = `<span style="color: #1a7f37; font-weight: 600;">Đang kết nối Live ID: ${res.liveVideoId}</span>`;
      }
    }
  });

  stopFbApiBtn.addEventListener("click", async () => {
    await window.liveCommentTts.stopFacebookApi();
    startFbApiBtn.disabled = false;
    stopFbApiBtn.disabled = true;
    if (fbApiStatusEl) {
      fbApiStatusEl.innerHTML = `<em>Đã dừng kết nối API.</em>`;
    }
  });

  window.liveCommentTts.onFacebookApiStatus((status) => {
    if (status.active) {
      startFbApiBtn.disabled = true;
      stopFbApiBtn.disabled = false;
    } else {
      startFbApiBtn.disabled = false;
      stopFbApiBtn.disabled = true;
    }
    if (fbApiStatusEl && status.message) {
      const color = status.level === "error" ? "#cf222e" : (status.active ? "#1a7f37" : "#57606a");
      fbApiStatusEl.innerHTML = `<span style="color: ${color}; font-weight: ${status.active ? 600 : 400};">${status.message}</span>`;
    }
  });
}
