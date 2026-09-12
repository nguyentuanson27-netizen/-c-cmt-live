const liveInput = document.querySelector("#live-input");
const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");
const toggleTtsButton = document.querySelector("#toggle-tts");
const clearQueueButton = document.querySelector("#clear-queue");
const statusElement = document.querySelector("#status");
const queueSummary = document.querySelector("#queue-summary");
const currentElement = document.querySelector("#current");
const recentElement = document.querySelector("#recent");

let audioContext = null;
let ttsPaused = false;

function setStatus(message, level = "info") {
  statusElement.textContent = message;
  statusElement.dataset.level = level;
}

async function postJson(path, body = {}) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
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

function addRecent(comment) {
  const item = document.createElement("li");
  const meta = document.createElement("div");
  meta.className = "comment-meta";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = comment.sourceLabel || "FB-API";
  const author = document.createElement("strong");
  author.textContent = comment.username;
  meta.append(badge, author);

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
  if (!snapshot.facebookConfigured) {
    setStatus("Server chưa có FACEBOOK_PAGE_ACCESS_TOKEN / FACEBOOK_GRAPH_API_VERSION.", "error");
  } else if (snapshot.active) {
    setStatus(`Đang kết nối Live ${snapshot.liveVideoId}.`);
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
    await unlockAudio();
    startButton.disabled = true;
    const result = await postJson("/api/facebook/start", { liveVideoIdOrUrl });
    setStatus(`Đã baseline Live ${result.liveVideoId}. Chờ comment mới…`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Không thể kết nối Facebook Graph API", "error");
  } finally {
    startButton.disabled = false;
  }
});

stopButton.addEventListener("click", async () => {
  try {
    await postJson("/api/facebook/stop");
    setStatus("Đã dừng lấy comment.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Không thể dừng kết nối", "error");
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
  } else if (event.type === "status") {
    setStatus(event.message || "", event.level || "info");
  } else if (event.type === "comment") {
    addRecent(event.comment);
  } else if (event.type === "queue") {
    ttsPaused = Boolean(event.paused);
    toggleTtsButton.textContent = ttsPaused ? "Tiếp tục" : "Tạm dừng";
    queueSummary.textContent = `Queue: ${event.size || 0}`;
    currentElement.textContent = event.current
      ? `${event.current.username}: ${event.current.text}`
      : "Chưa có comment đang đọc.";
  } else if (event.type === "playback") {
    void playAudioEvent(event);
  }
};
events.onerror = () => {
  setStatus("Mất kết nối realtime với server; trình duyệt đang tự reconnect…", "error");
};

fetch("/api/status")
  .then((response) => response.json())
  .then(applySnapshot)
  .catch(() => setStatus("Không đọc được trạng thái server.", "error"));
