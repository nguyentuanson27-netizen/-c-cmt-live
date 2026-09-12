import type { GraphFetch } from "./facebook-graph";

export type FacebookDiscoveredLive = {
  id: string;
  title?: string;
  status?: string;
  createdTime?: string;
};

export type FacebookLiveDiscoveryConfig = {
  token: string;
  apiVersion: string;
  limit?: number;
};

type FacebookLiveDiscoveryDependencies = {
  fetchFn?: GraphFetch;
};

type RawGraphLive = {
  id?: unknown;
  title?: unknown;
  status?: unknown;
  creation_time?: unknown;
};

type GraphLiveVideosResponse = {
  data?: unknown;
  error?: {
    message?: unknown;
    code?: unknown;
  };
};

const MAX_DISCOVERY_RESULTS = 25;
const MAX_TITLE_LENGTH = 200;
const MAX_STATUS_LENGTH = 64;
const MAX_CREATED_TIME_LENGTH = 64;
const MAX_ERROR_LENGTH = 300;

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, maxLength);
}

function normalizeLive(value: unknown): FacebookDiscoveredLive | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as RawGraphLive;
  const id = boundedString(raw.id, 64);
  if (!id || !/^\d+$/.test(id)) {
    return null;
  }

  const title = boundedString(raw.title, MAX_TITLE_LENGTH);
  const status = boundedString(raw.status, MAX_STATUS_LENGTH);
  const createdTime = boundedString(raw.creation_time, MAX_CREATED_TIME_LENGTH);

  return {
    id,
    ...(title ? { title } : {}),
    ...(status ? { status } : {}),
    ...(createdTime ? { createdTime } : {}),
  };
}

function sanitizeGraphMessage(value: unknown, token: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  let message = raw || "Facebook Graph API error";
  if (token) {
    message = message.split(token).join("[REDACTED]");
  }
  return message.slice(0, MAX_ERROR_LENGTH);
}

export async function discoverFacebookLiveVideos(
  config: FacebookLiveDiscoveryConfig,
  dependencies?: FacebookLiveDiscoveryDependencies,
): Promise<{ ok: true; lives: FacebookDiscoveredLive[] } | { ok: false; error: string }> {
  const token = config.token.trim();
  if (!token) {
    return { ok: false, error: "Missing Facebook Page Access Token" };
  }

  const apiVersion = config.apiVersion.trim();
  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    return { ok: false, error: "Invalid FACEBOOK_GRAPH_API_VERSION" };
  }

  const requestedLimit = Number.isFinite(config.limit)
    ? Math.floor(config.limit as number)
    : MAX_DISCOVERY_RESULTS;
  const limit = Math.min(MAX_DISCOVERY_RESULTS, Math.max(1, requestedLimit));

  const url = new URL(`https://graph.facebook.com/${apiVersion}/me/live_videos`);
  url.searchParams.set("broadcast_status", "LIVE");
  url.searchParams.set("fields", "id,title,status,creation_time");
  url.searchParams.set("limit", String(limit));

  const fetchFn = dependencies?.fetchFn ?? globalThis.fetch.bind(globalThis);

  try {
    const response = await fetchFn(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
      },
    });

    let payload: GraphLiveVideosResponse;
    try {
      payload = (await response.json()) as GraphLiveVideosResponse;
    } catch {
      return { ok: false, error: "Facebook Graph live discovery returned invalid JSON" };
    }

    if (payload.error) {
      const code = typeof payload.error.code === "number" ? payload.error.code : undefined;
      if (code === 190) {
        return { ok: false, error: "Facebook Page Access Token is invalid or expired" };
      }
      return {
        ok: false,
        error: `Facebook Graph live discovery failed: ${sanitizeGraphMessage(payload.error.message, token)}`,
      };
    }

    if (!response.ok) {
      return { ok: false, error: `Facebook Graph live discovery failed: HTTP ${response.status}` };
    }

    if (!Array.isArray(payload.data)) {
      return { ok: false, error: "Facebook Graph live discovery returned an invalid response" };
    }

    const lives: FacebookDiscoveredLive[] = [];
    for (const rawLive of payload.data) {
      const live = normalizeLive(rawLive);
      if (!live) {
        continue;
      }
      lives.push(live);
      if (lives.length >= limit) {
        break;
      }
    }

    return { ok: true, lives };
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Unknown network error";
    return {
      ok: false,
      error: `Facebook Graph live discovery request failed: ${sanitizeGraphMessage(rawMessage, token)}`,
    };
  }
}
