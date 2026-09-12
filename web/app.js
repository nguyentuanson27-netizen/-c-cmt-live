const liveInput = document.querySelector("#live-input");
const startButton = document.querySelector("#start");
const discoverButton = document.querySelector("#discover-lives");
const stopAllButton = document.querySelector("#stop-all");
const discoveredLivesElement = document.querySelector("#discovered-lives");
const discoverySummary = document.querySelector("#discovery-summary");
const activeLivesElement = document.querySelector("#active-lives");
const liveSummary = document.querySelector("#live-summary");
const toggleTtsButton = document.querySelector("#toggle-tts");
const clearQueueButton = document.querySelector("#clear-queue");
const statusElement = document.querySelector("#status");
const queueSummary = document.querySelector("#queue-summary");
const currentElement = document.querySelector("#current");
const recentElement = document.querySelector("#recent");

let audioContext = null;
let ttsPaused = false;
let activeLiveIds = [];
let discoveredLives = [];
let discoveryAttempted = false;
let discoveryFailed = false;
let pendingCount = 0;
let maxLives = 9;

function setStatus(message, level = "info") {
  statusElement.textContent = message;
  statusElement.dataset.level = level;
}

async function readJsonResponse(response) {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function getJson(path) {
  const response = await fetch(path, {
    headers: { accept: "application/json" },
  });
  return readJsonResponse(response);
}

async function postJson(path, body = {}) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJsonResponse(response);
}

async function unlockAudio() {
  if (!audioContext) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error("Trình duyệt không hỗ trợ Web Audio API");
    }
    audioContext = new AudioContextCtor();
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function playAudioEvent(event) {
  let success = false;
  try {
    await unlockAudio();
    const audioBuffer = await audioContext.decodeAudioData(decodeBase64(event.audioBase64));
    await new Promise((resolve, reject) => {
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.addEventListener("ended", resolve, { once: true });
      try {
        source.start();
      } catch (error) {
        reject(error);
      }
    });
    success = true;
  } catch (error) {
    setStatus(`Không phát được audio: ${error instanceof Error ? error.message : "unknown error"}`, "error");
  }

  try {
    await postJson("/api/playback/complete", { id: event.id, success });
  } catch {
    // A stale completion can legitimately race a stop/restart; status SSE remains authoritative.
  }
}

async function startLive(liveVideoIdOrUrl) {
  await unlockAudio();
  const result = await postJson("/api/facebook/start", { liveVideoIdOrUrl });
  applyLiveState(result);
  setStatus(`Đã baseline Live ${result.liveVideoId}. Chờ comment mới…`);
  return result;
}

async function stopLive(liveVideoId) {
  try {
    const result = await postJson("/api/facebook/stop", { liveVideoId });
    applyLiveState(result);
    setStatus(`Đã dừng Live ${liveVideoId}.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : `Không thể dừng Live ${liveVideoId}`, "error");
  }
}

function appendDiscoveryMessage(message) {
  const item = document.createElement("li");
  item.className = "live-empty";
  item.textContent = message;
  discoveredLivesElement.append(item);
}

function renderDiscoveredLives() {
  discoveredLivesElement.replaceChildren();

  if (!discoveryAttempted) {
    discoverySummary.textContent = "Chưa tìm";
    appendDiscoveryMessage("Bấm “Tìm live đang phát” để tải danh sách từ Facebook Graph API.");
    return;
  }

  if (discoveryFailed) {
    discoverySummary.textContent = "Lỗi";
    appendDiscoveryMessage("Không tải được danh sách live. Thử lại sau khi kiểm tra cấu hình/Graph API.");
    return;
  }

  discoverySummary.textContent = `${discoveredLives.length} live`;
  if (discoveredLives.length === 0) {
    appendDiscoveryMessage("Không tìm thấy live đang phát.");
    return;
  }

  for (const live of discoveredLives) {
    const item = document.createElement("li");
    item.className = "live-row";

    const label = document.createElement("span");
    const details = [];
    if (typeof live.title === "string" && live.title) {
      details.push(live.title);
    }
    details.push(`Live ${live.id}`);
    if (typeof live.status === "string" && live.status) {
      details.push(live.status);
    }
    label.textContent = details.join(" · ");

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "secondary small";
    const alreadyActive = activeLiveIds.includes(live.id);
    addButton.textContent = alreadyActive ? "Đã thêm" : "Thêm";
    addButton.disabled = alreadyActive;
    addButton.addEventListener("click", () => {
      addButton.disabled = true;
      void startLive(live.id)
        .catch((error) => {
          setStatus(error instanceof Error ? error.message : `Không thể thêm Live ${live.id}`, "error");
        })
        .finally(() => {
          renderDiscoveredLives();
        });
    });

    item.append(label, addButton);
    discoveredLivesElement.append(item);
  }
}

function renderLives() {
  liveSummary.textContent = `${activeLiveIds.length}/${maxLives} live${pendingCount ? ` · ${pendingCount} đang kết nối` : ""}`;
  stopAllButton.disabled = activeLiveIds.length === 0 && pendingCount === 0;
  activeLivesElement.replaceChildren();

  if (activeLiveIds.length === 0) {
    const empty = document.createElement("li");
    empty.className = "live-empty";
    empty.textContent = pendingCount > 0 ? "Đang kết nối live…" : "Chưa có live đang theo dõi.";
    activeLivesElement.append(empty);
    return;
  }

  for (const liveVideoId of activeLiveIds) {
    const item = document.createElement("li");
    item.className = "live-row";

    const label = document.createElement("span");
    label.textContent = `Live ${liveVideoId}`;

    const stopButton = document.createElement("button");
    stopButton.type = "button";
    stopButton.className = "secondary small";
    stopButton.textContent = "Dừng";
    stopButton.addEventListener("click", () => {
      stopButton.disabled = true;
      void stopLive(liveVideoId).finally(() => {
        stopButton.disabled = false;
      });
    });

    item.append(label, stopButton);
    activeLivesElement.append(item);
  }
}

function applyLiveState(state) {
  activeLiveIds = Array.isArray(state.activeLiveIds)
    ? state.activeLiveIds.filter((value) => typeof value === "string")
    : [];
  pendingCount = Number.isFinite(state.pendingCount) ? Math.max(0, state.pendingCount) : 0;
  maxLives = Number.isFinite(state.maxLives) ? Math.max(1, state.maxLives) : 9;
  renderLives();
  renderDiscoveredLives();
}

function addRecent(comment, liveVideoId) {
  const item = document.createElement("li");
  const meta = document.createElement("div");
  meta.className = "comment-meta";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = liveVideoId ? `Live ${liveVideoId}` : "Facebook Live";
  meta.append(badge);

  const text = document.createElement("p");
  text.textContent = comment.text;
  const latency = document.createElement("small");
  latency.textContent = `Graph → app: ${comment.observedLatencyMs} ms`;

  item.append(meta, text, latency);
  recentElement.prepend(item);
  while (recentElement.children.length > 50) {
    recentElement.lastElementChild.remove();
  }
}

function applySnapshot(snapshot) {
  applyLiveState(snapshot);
  if (!snapshot.facebookConfigured) {
    setStatus("Server chưa có FACEBOOK_PAGE_ACCESS_TOKEN / FACEBOOK_GRAPH_API_VERSION.", "error");
  } else if (activeLiveIds.length > 0) {
    setStatus(`Đang theo dõi ${activeLiveIds.length} Facebook Live.`);
  } else if (pendingCount > 0) {
    setStatus(`Đang kết nối ${pendingCount} Facebook Live…`);
  } else {
    setStatus("Server đã cấu hình. Chưa kết nối live.");
  }
  ttsPaused = Boolean(snapshot.ttsPaused ?? snapshot.paused);
  toggleTtsButton.textContent = ttsPaused ? "Tiếp tục" : "Tạm dừng";
  queueSummary.textContent = `Queue: ${snapshot.queueSize || 0}`;
}

startButton.addEventListener("click", async () => {
  const liveVideoIdOrUrl = liveInput.value.trim();
  if (!liveVideoIdOrUrl) {
    setStatus("Nhập Live Video ID hoặc URL Facebook trước.", "error");
    return;
  }
  try {
    startButton.disabled = true;
    await startLive(liveVideoIdOrUrl);
    liveInput.value = "";
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Không thể kết nối Facebook Graph API", "error");
  } finally {
    startButton.disabled = false;
  }
});

discoverButton.addEventListener("click", async () => {
  try {
    discoverButton.disabled = true;
    discoverySummary.textContent = "Đang tìm…";
    const result = await getJson("/api/facebook/live-videos");
    discoveredLives = Array.isArray(result.lives)
      ? result.lives.filter(
          (live) => live && typeof live === "object" && typeof live.id === "string" && /^\d+$/.test(live.id),
        )
      : [];
    discoveryAttempted = true;
    discoveryFailed = false;
    renderDiscoveredLives();
    setStatus(
      discoveredLives.length > 0
        ? `Tìm thấy ${discoveredLives.length} Facebook Live đang phát.`
        : "Không tìm thấy Facebook Live đang phát.",
    );
  } catch (error) {
    discoveredLives = [];
    discoveryAttempted = true;
    discoveryFailed = true;
    renderDiscoveredLives();
    setStatus(error instanceof Error ? error.message : "Không thể tìm Facebook Live", "error");
  } finally {
    discoverButton.disabled = false;
  }
});

stopAllButton.addEventListener("click", async () => {
  try {
    stopAllButton.disabled = true;
    const result = await postJson("/api/facebook/stop", {});
    applyLiveState(result);
    setStatus("Đã dừng tất cả Facebook Live.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Không thể dừng các kết nối", "error");
  } finally {
    renderLives();
  }
});

toggleTtsButton.addEventListener("click", async () => {
  try {
    await unlockAudio();
    const result = await postJson("/api/tts/toggle");
    ttsPaused = Boolean(result.paused);
    toggleTtsButton.textContent = ttsPaused ? "Tiếp tục" : "Tạm dừng";
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Không đổi được trạng thái TTS", "error");
  }
});

clearQueueButton.addEventListener("click", async () => {
  try {
    await postJson("/api/tts/clear");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Không xóa được queue", "error");
  }
});

const events = new EventSource("/api/events");
events.onmessage = (message) => {
  let event;
  try {
    event = JSON.parse(message.data);
  } catch {
    return;
  }

  if (event.type === "snapshot") {
    applySnapshot(event);
  } else if (event.type === "lives") {
    applyLiveState(event);
  } else if (event.type === "status") {
    const prefix = event.liveVideoId ? `Live ${event.liveVideoId}: ` : "";
    setStatus(`${prefix}${event.message || ""}`, event.level || "info");
  } else if (event.type === "comment") {
    addRecent(event.comment, event.liveVideoId);
  } else if (event.type === "queue") {
    ttsPaused = Boolean(event.paused);
    toggleTtsButton.textContent = ttsPaused ? "Tiếp tục" : "Tạm dừng";
    queueSummary.textContent = `Queue: ${event.size || 0}`;
    currentElement.textContent = event.current
      ? event.current.text
      : "Chưa có comment đang đọc.";
  } else if (event.type === "playback") {
    void playAudioEvent(event);
  }
};
events.onerror = () => {
  setStatus("Mất kết nối realtime với server; trình duyệt đang tự reconnect…", "error");
};

getJson("/api/status")
  .then(applySnapshot)
  .catch(() => setStatus("Không đọc được trạng thái server.", "error"));
