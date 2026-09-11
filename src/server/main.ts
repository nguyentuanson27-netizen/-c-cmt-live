import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CommentDedup } from "../core/dedup";
import { normalizeComment } from "../core/filter";
import { CommentQueue } from "../core/queue";
import type { Comment } from "../core/comment";
import { PlaybackManager } from "../tts/playback-manager";
import { TTSService } from "../tts/tts-service";
import {
  FacebookGraphCommentPoller,
  type FacebookGraphComment,
} from "./facebook-graph";
import {
  isLoopbackHost,
  loadFacebookServerConfig,
  parseFacebookStartRequest,
} from "./config";
import { SseHub } from "./events";
import { BrowserPlaybackBridge } from "./playback-bridge";

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const host = (process.env.HOST || "127.0.0.1").trim();
const port = Number(process.env.PORT || "3000");
if (!isLoopbackHost(host)) {
  throw new Error("This local runtime may only bind to loopback. Public/LAN hosting requires a separate auth design.");
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const webRoot = resolve(__dirname, "../../web");
const hub = new SseHub();
const graphPoller = new FacebookGraphCommentPoller();
const commentQueue = new CommentQueue(30, 30_000);
const commentDedup = new CommentDedup({ windowMs: 60_000, maxEntries: 2000 });
const ttsService = new TTSService();
const playbackBridge = new BrowserPlaybackBridge((event) => {
  hub.broadcastOne(event);
});
let ttsPaused = false;

function broadcastStatus(message: string, level: "info" | "error" = "info"): void {
  hub.broadcast({
    type: "status",
    message,
    level,
    active: graphPoller.isActive,
    liveVideoId: graphPoller.activeLiveVideoId,
  });
}

function broadcastQueueState(current: Comment | null = playbackManager.getCurrentComment()): void {
  hub.broadcast({
    type: "queue",
    size: commentQueue.size(),
    paused: ttsPaused,
    current: current
      ? {
          id: current.id,
          username: current.username,
          text: current.text,
          sourceLabel: current.sourceLabel,
        }
      : null,
  });
}

const playbackManager = new PlaybackManager(commentQueue, ttsService, {
  onSpeakStart: (comment) => {
    hub.broadcast({
      type: "tts",
      state: "speaking",
      comment: {
        id: comment.id,
        username: comment.username,
        text: comment.text,
        sourceLabel: comment.sourceLabel,
      },
    });
    broadcastQueueState(comment);
  },
  onSpeakEnd: () => {
    hub.broadcast({ type: "tts", state: "idle" });
    broadcastQueueState(null);
  },
  onQueueUpdate: () => broadcastQueueState(),
  playAudio: (id, audioBase64) => {
    if (hub.clientCount === 0) {
      return Promise.resolve({ success: false });
    }
    return playbackBridge.playAudio(id, audioBase64);
  },
});

function handleGraphComment(graphComment: FacebookGraphComment): void {
  const liveVideoId = graphPoller.activeLiveVideoId;
  if (!liveVideoId) {
    return;
  }

  const normalized = normalizeComment(graphComment.username, graphComment.text);
  if (!normalized) {
    return;
  }

  // Only one Graph live is active in this slice. Clearing this dedup state on every
  // successful start scopes it to the current live without changing shared core APIs yet.
  if (commentDedup.isDuplicate(normalized.username, normalized.text)) {
    return;
  }
  commentDedup.record(normalized.username, normalized.text);

  const receivedAt = Date.now();
  const item: Comment = {
    id: graphComment.id,
    platform: "facebook",
    sourceId: `facebook-graph:${liveVideoId}`,
    sourceLabel: "FB-API",
    username: normalized.username,
    text: normalized.text,
    receivedAt,
  };

  commentQueue.enqueue(item);
  hub.broadcast({
    type: "comment",
    comment: {
      id: item.id,
      username: item.username,
      text: item.text,
      sourceLabel: item.sourceLabel,
      receivedAt,
      observedLatencyMs: Math.max(0, receivedAt - graphComment.timestamp),
    },
  });
  broadcastQueueState();
  void playbackManager.processNext();
}

function securityHeaders(response: ServerResponse): void {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' data: blob:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  securityHeaders(response);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(value));
}

function isTrustedOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:" && isLoopbackHost(parsed.hostname) && parsed.port === String(port);
  } catch {
    return false;
  }
}

async function readJsonBody(request: IncomingMessage, maxBytes = 8192): Promise<unknown> {
  const contentType = request.headers["content-type"] || "";
  if (!String(contentType).toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json");
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) {
      throw new HttpError(413, "Request body is too large");
    }
    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

async function serveStatic(pathname: string, response: ServerResponse): Promise<boolean> {
  const assets: Record<string, { file: string; contentType: string }> = {
    "/": { file: "index.html", contentType: "text/html; charset=utf-8" },
    "/app.js": { file: "app.js", contentType: "text/javascript; charset=utf-8" },
    "/app.css": { file: "app.css", contentType: "text/css; charset=utf-8" },
  };
  const asset = assets[pathname];
  if (!asset) {
    return false;
  }

  const content = await readFile(resolve(webRoot, asset.file));
  securityHeaders(response);
  response.statusCode = 200;
  response.setHeader("Content-Type", asset.contentType);
  response.setHeader("Cache-Control", pathname === "/" ? "no-store" : "public, max-age=300");
  response.end(content);
  return true;
}

function statusPayload(): Record<string, unknown> {
  const facebookConfig = loadFacebookServerConfig(process.env);
  return {
    active: graphPoller.isActive,
    liveVideoId: graphPoller.activeLiveVideoId,
    facebookConfigured: facebookConfig.ok,
    queueSize: commentQueue.size(),
    ttsPaused,
    browserClients: hub.clientCount,
  };
}

const server = createServer(async (request, response) => {
  const method = request.method || "GET";
  const url = new URL(request.url || "/", `http://${host}:${port}`);

  try {
    if (method === "GET" && (await serveStatic(url.pathname, response))) {
      return;
    }

    if (method === "GET" && url.pathname === "/healthz") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (method === "GET" && url.pathname === "/api/status") {
      sendJson(response, 200, statusPayload());
      return;
    }

    if (method === "GET" && url.pathname === "/api/events") {
      if (!isTrustedOrigin(request)) {
        sendJson(response, 403, { ok: false, error: "Untrusted browser origin" });
        return;
      }
      securityHeaders(response);
      response.statusCode = 200;
      response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Connection", "keep-alive");
      response.flushHeaders();
      const removeClient = hub.addClient(response);
      response.write(`data: ${JSON.stringify({ type: "snapshot", ...statusPayload() })}\n\n`);
      const heartbeat = setInterval(() => response.write(": ping\n\n"), 15_000);
      request.on("close", () => {
        clearInterval(heartbeat);
        removeClient();
      });
      return;
    }

    if (method === "POST" && !isTrustedOrigin(request)) {
      sendJson(response, 403, { ok: false, error: "Untrusted browser origin" });
      return;
    }

    if (method === "POST" && url.pathname === "/api/facebook/start") {
      const browserRequest = parseFacebookStartRequest(await readJsonBody(request));
      if (!browserRequest.ok) {
        sendJson(response, 400, browserRequest);
        return;
      }
      const serverConfig = loadFacebookServerConfig(process.env);
      if (!serverConfig.ok) {
        sendJson(response, 503, serverConfig);
        return;
      }

      const result = await graphPoller.start(
        {
          ...serverConfig.config,
          liveVideoIdOrUrl: browserRequest.liveVideoIdOrUrl,
          pollIntervalMs: 1000,
          pageSize: 100,
          maxPagesPerPoll: 20,
        },
        {
          onComment: handleGraphComment,
          onStatus: broadcastStatus,
        },
      );

      if (result.ok) {
        commentQueue.clear();
        commentDedup.clear();
        broadcastQueueState();
      }

      sendJson(response, result.ok ? 200 : 502, result);
      return;
    }

    if (method === "POST" && url.pathname === "/api/facebook/stop") {
      await readJsonBody(request);
      graphPoller.stop();
      commentQueue.clear();
      commentDedup.clear();
      broadcastQueueState();
      sendJson(response, 200, { ok: true });
      return;
    }

    if (method === "POST" && url.pathname === "/api/tts/toggle") {
      await readJsonBody(request);
      ttsPaused = !ttsPaused;
      playbackManager.setPaused(ttsPaused);
      broadcastQueueState();
      sendJson(response, 200, { ok: true, paused: ttsPaused });
      return;
    }

    if (method === "POST" && url.pathname === "/api/tts/clear") {
      await readJsonBody(request);
      commentQueue.clear();
      broadcastQueueState();
      sendJson(response, 200, { ok: true });
      return;
    }

    if (method === "POST" && url.pathname === "/api/playback/complete") {
      const body = await readJsonBody(request, 2048);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        sendJson(response, 400, { ok: false, error: "Invalid playback completion payload" });
        return;
      }
      const record = body as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";
      const success = record.success;
      if (!id || id.length > 256 || typeof success !== "boolean") {
        sendJson(response, 400, { ok: false, error: "Invalid playback completion payload" });
        return;
      }
      const accepted = playbackBridge.complete(id, success);
      sendJson(response, accepted ? 200 : 409, { ok: accepted });
      return;
    }

    sendJson(response, 404, { ok: false, error: "Not found" });
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(response, error.status, { ok: false, error: error.message });
      return;
    }
    console.error("Web runtime request failed", error instanceof Error ? error.message : "unknown error");
    sendJson(response, 500, { ok: false, error: "Internal server error" });
  }
});

server.listen(port, host, () => {
  console.log(`Live Comment TTS web runtime: http://${host}:${port}`);
  if (!loadFacebookServerConfig(process.env).ok) {
    console.log("Facebook Graph API is not configured yet. Set FACEBOOK_PAGE_ACCESS_TOKEN and FACEBOOK_GRAPH_API_VERSION on the server.");
  }
});

function shutdown(): void {
  graphPoller.stop();
  playbackBridge.cancelPending();
  commentQueue.clear();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 2_000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
