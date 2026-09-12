export type TikTokEulerComment = {
  id: string;
  username: string;
  text: string;
  timestamp: number;
};

const EULER_WEBSOCKET_URL = "wss://ws.eulerstream.com/";
const MAX_UNIQUE_ID_LENGTH = 64;
const MAX_USERNAME_LENGTH = 128;
const MAX_COMMENT_LENGTH = 1000;
const MAX_MESSAGE_ID_LENGTH = 128;
const MAX_BUNDLE_MESSAGES = 200;
const MAX_ERROR_LENGTH = 300;
const UNIQUE_ID_PATTERN = /^[A-Za-z0-9._]+$/;

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    if (typeof value === "number" && Number.isFinite(value)) {
      value = String(value);
    } else if (typeof value === "bigint") {
      value = value.toString();
    } else {
      return null;
    }
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, maxLength);
}

function parsePositiveTimestamp(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

export function extractTikTokUniqueId(input: string): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2048) {
    return null;
  }

  let uniqueId = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }

    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || (hostname !== "www.tiktok.com" && hostname !== "tiktok.com")) {
      return null;
    }

    const match = url.pathname.match(/^\/@([^/]+)\/live\/?$/);
    if (!match) {
      return null;
    }
    uniqueId = match[1];
  } else if (uniqueId.startsWith("@")) {
    uniqueId = uniqueId.slice(1);
  }

  if (
    !uniqueId ||
    uniqueId.length > MAX_UNIQUE_ID_LENGTH ||
    !UNIQUE_ID_PATTERN.test(uniqueId)
  ) {
    return null;
  }

  return uniqueId;
}

export function buildEulerWebSocketUrl(uniqueId: string, apiKey: string): string {
  const normalizedUniqueId = extractTikTokUniqueId(uniqueId);
  const normalizedApiKey = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!normalizedUniqueId) {
    throw new Error("Invalid TikTok creator username or LIVE URL");
  }
  if (!normalizedApiKey) {
    throw new Error("EULER_API_KEY is not configured on the server");
  }

  const url = new URL(EULER_WEBSOCKET_URL);
  url.searchParams.set("uniqueId", normalizedUniqueId);
  url.searchParams.set("apiKey", normalizedApiKey);
  url.searchParams.set("schemaVersion", "v2");
  url.searchParams.set("features.bundleEvents", "true");
  url.searchParams.set("features.rawMessages", "false");
  url.searchParams.set("features.normalizeUniqueId", "true");
  return url.toString();
}

export function sanitizeEulerError(value: unknown, apiKey: string): string {
  const raw = value instanceof Error
    ? value.message
    : typeof value === "string"
      ? value
      : "Euler Stream error";
  let message = raw.trim() || "Euler Stream error";
  if (apiKey) {
    message = message.split(apiKey).join("[REDACTED]");
  }
  return message.slice(0, MAX_ERROR_LENGTH);
}

function normalizeChatMessage(
  rawMessage: unknown,
  bundleTimestamp: number | null,
  index: number,
): TikTokEulerComment | null {
  if (!rawMessage || typeof rawMessage !== "object" || Array.isArray(rawMessage)) {
    return null;
  }

  const message = rawMessage as Record<string, unknown>;
  if (message.type !== "WebcastChatMessage") {
    return null;
  }
  if (!message.data || typeof message.data !== "object" || Array.isArray(message.data)) {
    return null;
  }

  const data = message.data as Record<string, unknown>;
  const user = data.user && typeof data.user === "object" && !Array.isArray(data.user)
    ? data.user as Record<string, unknown>
    : null;
  if (!user) {
    return null;
  }

  const username =
    boundedString(user.uniqueId, MAX_USERNAME_LENGTH) ??
    boundedString(user.displayId, MAX_USERNAME_LENGTH) ??
    boundedString(user.nickname, MAX_USERNAME_LENGTH);
  const text =
    boundedString(data.comment, MAX_COMMENT_LENGTH) ??
    boundedString(data.content, MAX_COMMENT_LENGTH);
  if (!username || !text) {
    return null;
  }

  const common = data.common && typeof data.common === "object" && !Array.isArray(data.common)
    ? data.common as Record<string, unknown>
    : null;
  const timestamp =
    parsePositiveTimestamp(common?.createTime) ??
    parsePositiveTimestamp(data.createTime) ??
    bundleTimestamp ??
    Date.now();
  const id =
    boundedString(common?.msgId, MAX_MESSAGE_ID_LENGTH) ??
    boundedString(data.msgId, MAX_MESSAGE_ID_LENGTH) ??
    `${timestamp}:${index}`;

  return { id, username, text, timestamp };
}

export function parseEulerMessageBundle(payload: unknown): TikTokEulerComment[] {
  let parsed: unknown = payload;
  if (typeof payload === "string") {
    try {
      parsed = JSON.parse(payload) as unknown;
    } catch {
      return [];
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return [];
  }

  const bundle = parsed as Record<string, unknown>;
  if (!Array.isArray(bundle.messages)) {
    return [];
  }

  const bundleTimestamp = parsePositiveTimestamp(bundle.timestamp);
  const comments: TikTokEulerComment[] = [];
  const messages = bundle.messages.slice(0, MAX_BUNDLE_MESSAGES);
  for (let index = 0; index < messages.length; index += 1) {
    const comment = normalizeChatMessage(messages[index], bundleTimestamp, index);
    if (comment) {
      comments.push(comment);
    }
  }
  return comments;
}
