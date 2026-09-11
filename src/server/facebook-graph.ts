export type GraphFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type FacebookGraphComment = {
  id: string;
  username: string;
  text: string;
  createdTime: string;
  timestamp: number;
};

export type FacebookGraphEvents = {
  onComment: (comment: FacebookGraphComment) => void;
  onStatus: (message: string, level: "info" | "error") => void;
};

export type FacebookGraphConfig = {
  token: string;
  apiVersion: string;
  liveVideoIdOrUrl: string;
  pollIntervalMs?: number;
  pageSize?: number;
  maxPagesPerPoll?: number;
};

type ResolvedFacebookGraphConfig = {
  token: string;
  apiVersion: string;
  liveVideoIdOrUrl: string;
  pollIntervalMs: number;
  pageSize: number;
  maxPagesPerPoll: number;
};

type RawGraphComment = {
  id?: string;
  from?: { id?: string; name?: string };
  message?: string;
  created_time?: string;
};

type GraphCommentsResponse = {
  data?: RawGraphComment[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
  };
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
  };
};

type PollerDependencies = {
  fetchFn?: GraphFetch;
};

type PageResult = {
  comments: RawGraphComment[];
  after?: string;
};

class FacebookGraphApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
  }
}

const FACEBOOK_HOST = "facebook.com";

function isFacebookHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === FACEBOOK_HOST || normalized.endsWith(`.${FACEBOOK_HOST}`);
}

export function extractFacebookLiveVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if ((url.protocol !== "https:" && url.protocol !== "http:") || !isFacebookHostname(url.hostname)) {
    return null;
  }

  const queryVideoId = url.searchParams.get("v");
  if (queryVideoId && /^\d+$/.test(queryVideoId)) {
    return queryVideoId;
  }

  const videoMatch = url.pathname.match(/\/videos\/(\d+)(?:\/|$)/i);
  if (videoMatch?.[1]) {
    return videoMatch[1];
  }

  const liveMatch = url.pathname.match(/\/(?:watch\/)?live\/(\d+)(?:\/|$)/i);
  if (liveMatch?.[1]) {
    return liveMatch[1];
  }

  return null;
}

export class FacebookGraphCommentPoller {
  private readonly fetchFn: GraphFetch;
  private timer: NodeJS.Timeout | null = null;
  private abortController: AbortController | null = null;
  private pendingStartController: AbortController | null = null;
  private runId = 0;
  private startAttemptId = 0;
  private active = false;
  private config: ResolvedFacebookGraphConfig | null = null;
  private events: FacebookGraphEvents | null = null;
  private currentLiveVideoId: string | null = null;
  private boundaryCommentId: string | null = null;

  constructor(dependencies?: PollerDependencies) {
    this.fetchFn = dependencies?.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  public get isActive(): boolean {
    return this.active;
  }

  public get activeLiveVideoId(): string | null {
    return this.currentLiveVideoId;
  }

  public async start(
    config: FacebookGraphConfig,
    events: FacebookGraphEvents,
  ): Promise<{ ok: boolean; liveVideoId?: string; error?: string }> {
    const token = config.token.trim();
    if (!token) {
      return { ok: false, error: "Missing Facebook Page Access Token" };
    }

    const apiVersion = config.apiVersion.trim();
    if (!/^v\d+\.\d+$/.test(apiVersion)) {
      return { ok: false, error: "Invalid FACEBOOK_GRAPH_API_VERSION" };
    }

    const liveVideoId = extractFacebookLiveVideoId(config.liveVideoIdOrUrl);
    if (!liveVideoId) {
      return { ok: false, error: "Invalid Facebook Live video ID or URL" };
    }

    const candidateConfig: ResolvedFacebookGraphConfig = {
      token,
      apiVersion,
      liveVideoIdOrUrl: config.liveVideoIdOrUrl,
      pollIntervalMs: Math.max(250, config.pollIntervalMs ?? 1000),
      pageSize: Math.min(100, Math.max(1, Math.floor(config.pageSize ?? 100))),
      maxPagesPerPoll: Math.min(50, Math.max(1, Math.floor(config.maxPagesPerPoll ?? 20))),
    };

    this.pendingStartController?.abort();
    const attemptId = ++this.startAttemptId;
    const candidateController = new AbortController();
    this.pendingStartController = candidateController;

    events.onStatus(`[FB-API] Connecting to Live Video ${liveVideoId}...`, "info");

    try {
      const baseline = await this.fetchPageWith(
        candidateConfig,
        liveVideoId,
        candidateController.signal,
      );
      if (!this.isCurrentStartAttempt(attemptId)) {
        return { ok: false, error: "Facebook Graph connection was superseded" };
      }

      this.pendingStartController = null;
      this.invalidateRun(false);
      const runId = this.runId;

      this.config = candidateConfig;
      this.events = events;
      this.currentLiveVideoId = liveVideoId;
      this.boundaryCommentId = baseline.comments.find((comment) => Boolean(comment.id))?.id ?? null;
      this.abortController = candidateController;
      this.active = true;

      events.onStatus(
        this.boundaryCommentId
          ? "[FB-API] Connected. Existing comments were baselined."
          : "[FB-API] Connected. Waiting for the first new comment.",
        "info",
      );
      this.scheduleNext(runId);
      return { ok: true, liveVideoId };
    } catch (error) {
      if (!this.isCurrentStartAttempt(attemptId)) {
        return { ok: false, error: "Facebook Graph connection was superseded" };
      }

      this.pendingStartController = null;
      const message = this.errorMessage(error);
      if (error instanceof FacebookGraphApiError && error.code === 190) {
        const detail = `Page Access Token is invalid or expired: ${message}`;
        events.onStatus(`[FB-API] ${detail}`, "error");
        return { ok: false, error: detail };
      }
      return { ok: false, error: message };
    }
  }

  public stop(): void {
    const events = this.events;
    const wasActive = this.active || this.currentLiveVideoId !== null;
    this.startAttemptId += 1;
    this.pendingStartController?.abort();
    this.pendingStartController = null;
    this.invalidateRun(false);
    if (wasActive) {
      events?.onStatus("[FB-API] Connection stopped.", "info");
    }
  }

  public async pollNow(): Promise<void> {
    const runId = this.runId;
    if (!this.active || !this.config || !this.events || !this.currentLiveVideoId) {
      return;
    }
    await this.pollOnce(runId);
  }

  private invalidateRun(clearEvents: boolean): void {
    this.runId += 1;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.abortController?.abort();
    this.abortController = null;
    this.active = false;
    this.currentLiveVideoId = null;
    this.boundaryCommentId = null;
    this.config = null;
    if (clearEvents) {
      this.events = null;
    }
  }

  private isCurrentRun(runId: number): boolean {
    return this.runId === runId;
  }

  private isCurrentStartAttempt(attemptId: number): boolean {
    return this.startAttemptId === attemptId;
  }

  private scheduleNext(runId: number): void {
    if (!this.active || !this.config || !this.isCurrentRun(runId)) {
      return;
    }

    this.timer = setTimeout(() => {
      void this.pollOnce(runId).finally(() => {
        if (this.active && this.isCurrentRun(runId)) {
          this.scheduleNext(runId);
        }
      });
    }, this.config.pollIntervalMs);
  }

  private async pollOnce(runId: number): Promise<void> {
    if (!this.active || !this.config || !this.events || !this.isCurrentRun(runId)) {
      return;
    }

    const previousBoundary = this.boundaryCommentId;
    const collected: RawGraphComment[] = [];
    let newestCommentId: string | null = null;
    let after: string | undefined;
    let foundBoundary = false;
    let reachedEnd = false;

    try {
      for (let pageNumber = 0; pageNumber < this.config.maxPagesPerPoll; pageNumber += 1) {
        const page = await this.fetchPage(runId, after);
        if (!this.isCurrentRun(runId) || !this.active) {
          return;
        }

        if (!newestCommentId) {
          newestCommentId = page.comments.find((comment) => Boolean(comment.id))?.id ?? null;
        }

        for (const comment of page.comments) {
          if (previousBoundary && comment.id === previousBoundary) {
            foundBoundary = true;
            break;
          }
          collected.push(comment);
        }

        if (foundBoundary) {
          break;
        }

        after = page.after;
        if (!after) {
          reachedEnd = true;
          break;
        }
      }

      if (previousBoundary && !foundBoundary) {
        this.events.onStatus(
          reachedEnd
            ? "[FB-API] Previous comment boundary was not found; refusing to advance to avoid replaying old comments."
            : "[FB-API] Comment burst exceeded the pagination safety cap; retrying without advancing the boundary.",
          "error",
        );
        return;
      }

      if (!previousBoundary && !reachedEnd && after) {
        this.events.onStatus(
          "[FB-API] Comment burst exceeded the pagination safety cap; retrying without advancing the boundary.",
          "error",
        );
        return;
      }

      for (const raw of collected.reverse()) {
        if (!this.isCurrentRun(runId) || !this.active) {
          return;
        }
        const comment = this.normalizeRawComment(raw);
        if (comment) {
          this.events.onComment(comment);
        }
      }

      if (newestCommentId) {
        this.boundaryCommentId = newestCommentId;
      }
    } catch (error) {
      if (!this.isCurrentRun(runId) || !this.active) {
        return;
      }

      if (error instanceof FacebookGraphApiError && error.code === 190) {
        const events = this.events;
        const message = this.errorMessage(error);
        this.invalidateRun(false);
        events?.onStatus(`[FB-API] Page Access Token is invalid or expired: ${message}`, "error");
        return;
      }

      this.events.onStatus(`[FB-API] ${this.errorMessage(error)}`, "error");
    }
  }

  private async fetchPage(runId: number, after?: string): Promise<PageResult> {
    if (!this.config || !this.currentLiveVideoId || !this.abortController || !this.isCurrentRun(runId)) {
      throw new Error("Facebook Graph connector is not active");
    }

    return this.fetchPageWith(
      this.config,
      this.currentLiveVideoId,
      this.abortController.signal,
      after,
    );
  }

  private async fetchPageWith(
    config: ResolvedFacebookGraphConfig,
    liveVideoId: string,
    signal: AbortSignal,
    after?: string,
  ): Promise<PageResult> {
    const url = new URL(
      `https://graph.facebook.com/${config.apiVersion}/${liveVideoId}/comments`,
    );
    url.searchParams.set("order", "reverse_chronological");
    url.searchParams.set("fields", "id,from,message,created_time");
    url.searchParams.set("limit", String(config.pageSize));
    if (after) {
      url.searchParams.set("after", after);
    }

    const response = await this.fetchFn(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${config.token}`,
      },
      signal,
    });

    const payload = (await response.json()) as GraphCommentsResponse;
    if (payload.error) {
      throw new FacebookGraphApiError(
        payload.error.message || "Facebook Graph API error",
        payload.error.code,
      );
    }

    if (!response.ok) {
      throw new Error(`Facebook Graph API HTTP ${response.status}`);
    }

    return {
      comments: Array.isArray(payload.data) ? payload.data : [],
      after: payload.paging?.cursors?.after,
    };
  }

  private normalizeRawComment(raw: RawGraphComment): FacebookGraphComment | null {
    const id = raw.id?.trim();
    const text = raw.message?.trim();
    if (!id || !text) {
      return null;
    }

    const username = raw.from?.name?.trim() || "Facebook viewer";
    const createdTime = raw.created_time || new Date().toISOString();
    const parsedTimestamp = Date.parse(createdTime);

    return {
      id,
      username,
      text,
      createdTime,
      timestamp: Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now(),
    };
  }

  private errorMessage(error: unknown): string {
    if (error instanceof DOMException && error.name === "AbortError") {
      return "Facebook Graph request was aborted";
    }
    return error instanceof Error ? error.message : "Unknown Facebook Graph API error";
  }
}
