export type FacebookServerConfig = {
  token: string;
  apiVersion: string;
};

export type FacebookStartRequest = {
  liveVideoIdOrUrl: string;
};

export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  const unwrapped = normalized.startsWith("[") && normalized.endsWith("]")
    ? normalized.slice(1, -1)
    : normalized;
  return unwrapped === "127.0.0.1" || unwrapped === "localhost" || unwrapped === "::1";
}

export function loadFacebookServerConfig(
  env: NodeJS.ProcessEnv,
): { ok: true; config: FacebookServerConfig } | { ok: false; error: string } {
  const token = env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() ?? "";
  const apiVersion = env.FACEBOOK_GRAPH_API_VERSION?.trim() ?? "";

  if (!token) {
    return { ok: false, error: "FACEBOOK_PAGE_ACCESS_TOKEN is not configured on the server" };
  }
  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    return {
      ok: false,
      error: "FACEBOOK_GRAPH_API_VERSION must be configured explicitly, for example vXX.X",
    };
  }

  return { ok: true, config: { token, apiVersion } };
}

export function parseFacebookStartRequest(
  value: unknown,
): { ok: true; liveVideoIdOrUrl: string } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const record = value as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, "token")) {
    return { ok: false, error: "Page Access Token must be configured on the server, not sent by the browser" };
  }

  const liveVideoIdOrUrl = typeof record.liveVideoIdOrUrl === "string"
    ? record.liveVideoIdOrUrl.trim()
    : "";
  if (!liveVideoIdOrUrl || liveVideoIdOrUrl.length > 2048) {
    return { ok: false, error: "liveVideoIdOrUrl must be a non-empty string up to 2048 characters" };
  }

  return { ok: true, liveVideoIdOrUrl };
}

export function parseFacebookStopRequest(
  value: unknown,
): { ok: true; liveVideoId?: string } | { ok: false; error: string } {
  if (value === null || value === undefined) {
    return { ok: true };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const record = value as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, "token")) {
    return { ok: false, error: "Page Access Token must be configured on the server, not sent by the browser" };
  }

  if (!Object.prototype.hasOwnProperty.call(record, "liveVideoId")) {
    return { ok: true };
  }

  const liveVideoId = typeof record.liveVideoId === "string" ? record.liveVideoId.trim() : "";
  if (!/^\d+$/.test(liveVideoId)) {
    return { ok: false, error: "liveVideoId must be a numeric Facebook Live Video ID" };
  }

  return { ok: true, liveVideoId };
}
