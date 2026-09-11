export type FacebookApiComment = {
  id: string;
  username: string;
  text: string;
  createdTime: string;
  timestamp: number;
};

export type GraphApiConnectorEvents = {
  onComment: (comment: FacebookApiComment) => void;
  onStatus: (message: string, level: "info" | "error") => void;
  onError?: (error: Error) => void;
};

export type GraphApiConnectorConfig = {
  token: string;
  liveVideoIdOrUrl?: string;
  pollIntervalMs?: number;
  apiVersion?: string;
};

export function extractFacebookLiveVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  // Direct numeric ID
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : "https://" + trimmed);
    const vParam = url.searchParams.get("v");
    if (vParam && /^\d+$/.test(vParam)) {
      return vParam;
    }

    const videoMatch = url.pathname.match(/\/videos\/(\d+)/i);
    if (videoMatch && videoMatch[1]) {
      return videoMatch[1];
    }

    const liveMatch = url.pathname.match(/\/(?:live|watch)\/(\d+)/i);
    if (liveMatch && liveMatch[1]) {
      return liveMatch[1];
    }

    const postMatch = url.pathname.match(/\/posts\/(\d+)/i);
    if (postMatch && postMatch[1]) {
      return postMatch[1];
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts.pop();
    if (last && /^\d+$/.test(last)) {
      return last;
    }
  } catch {
    const match = trimmed.match(/(?:videos|live|watch|posts|v=)[\/]?(\d+)/i);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export class FacebookGraphApiConnector {
  private active = false;
  private timer: NodeJS.Timeout | null = null;
  private seenCommentIds = new Set<string>();
  private currentLiveVideoId: string | null = null;
  private config: GraphApiConnectorConfig | null = null;
  private events: GraphApiConnectorEvents | null = null;
  private isBaselined = false;

  public get isActive(): boolean {
    return this.active;
  }

  public get activeLiveVideoId(): string | null {
    return this.currentLiveVideoId;
  }

  public async start(
    config: GraphApiConnectorConfig,
    events: GraphApiConnectorEvents
  ): Promise<{ ok: boolean; liveVideoId?: string; error?: string }> {
    if (this.active) {
      this.stop();
    }

    const token = config.token.trim();
    if (!token) {
      return { ok: false, error: "Chưa nhập Page Access Token." };
    }

    const apiVersion = config.apiVersion ?? "v19.0";
    let liveVideoId: string | null = null;

    if (config.liveVideoIdOrUrl && config.liveVideoIdOrUrl.trim()) {
      liveVideoId = extractFacebookLiveVideoId(config.liveVideoIdOrUrl);
      if (!liveVideoId) {
        return {
          ok: false,
          error: "Không thể trích xuất Video ID từ URL hoặc mã bạn đã nhập. Vui lòng kiểm tra lại.",
        };
      }
    } else {
      events.onStatus("Đang tự động dò tìm phiên live đang phát (LIVE_NOW) trên Page...", "info");
      try {
        const detectUrl = `https://graph.facebook.com/${apiVersion}/me/live_videos?status=LIVE_NOW&access_token=${encodeURIComponent(token)}&fields=id,title,creation_time`;
        const res = await fetch(detectUrl);
        const data = (await res.json()) as {
          data?: Array<{ id: string; title?: string }>;
          error?: { message: string; code?: number };
        };

        if (data.error) {
          return {
            ok: false,
            error: `Facebook API báo lỗi: ${data.error.message} (code ${data.error.code})`,
          };
        }

        if (data.data && data.data.length > 0) {
          liveVideoId = data.data[0].id;
          const titleStr = data.data[0].title ? ` (${data.data[0].title})` : "";
          events.onStatus(`Đã tìm thấy phiên live đang phát: ID ${liveVideoId}${titleStr}`, "info");
        } else {
          return {
            ok: false,
            error:
              "Không tìm thấy phiên live nào đang phát (LIVE_NOW) trên Page. Vui lòng nhập trực tiếp Video ID hoặc URL phiên live.",
          };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Lỗi kết nối Facebook API";
        return { ok: false, error: `Không thể kết nối đến Facebook Graph API: ${msg}` };
      }
    }

    this.active = true;
    this.currentLiveVideoId = liveVideoId;
    this.config = { ...config, token, apiVersion };
    this.events = events;
    this.seenCommentIds.clear();
    this.isBaselined = false;

    events.onStatus(`[FB-API] Đang kết nối tới phiên live ${liveVideoId}...`, "info");
    void this.pollLoop();
    return { ok: true, liveVideoId };
  }

  public stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.active = false;
    this.currentLiveVideoId = null;
    this.isBaselined = false;
    if (this.events) {
      this.events.onStatus("[FB-API] Đã dừng kết nối Graph API.", "info");
    }
  }

  private async pollLoop(): Promise<void> {
    if (!this.active || !this.config || !this.events || !this.currentLiveVideoId) {
      return;
    }

    const intervalMs = Math.max(10, this.config.pollIntervalMs ?? 1000);
    try {
      await this.fetchComments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi mạng khi gọi API";
      this.events.onStatus(`[FB-API] Cảnh báo kết nối: ${msg}`, "error");
    }

    if (this.active) {
      this.timer = setTimeout(() => {
        void this.pollLoop();
      }, intervalMs);
    }
  }

  private async fetchComments(): Promise<void> {
    if (!this.active || !this.config || !this.events || !this.currentLiveVideoId) {
      return;
    }

    const { token, apiVersion = "v19.0" } = this.config;
    const url = `https://graph.facebook.com/${apiVersion}/${this.currentLiveVideoId}/comments?order=reverse_chronological&fields=id,from,message,created_time&limit=30&access_token=${encodeURIComponent(token)}`;

    const res = await fetch(url);
    const data = (await res.json()) as {
      data?: Array<{
        id: string;
        from?: { id: string; name: string };
        message?: string;
        created_time?: string;
      }>;
      error?: { message: string; code?: number; error_subcode?: number };
    };

    if (data.error) {
      if (data.error.code === 190) {
        this.events.onStatus(`[FB-API] Token không hợp lệ hoặc đã hết hạn: ${data.error.message}`, "error");
        this.stop();
        return;
      }
      this.events.onStatus(`[FB-API] Lỗi: ${data.error.message}`, "error");
      return;
    }

    const rawComments = data.data || [];

    if (!this.isBaselined) {
      for (const item of rawComments) {
        if (item.id) {
          this.seenCommentIds.add(item.id);
        }
      }
      this.isBaselined = true;
      this.events.onStatus(
        `[FB-API] Kết nối thành công! Đã ghi nhận ${rawComments.length} bình luận ban đầu (baseline). Sẵn sàng đọc bình luận mới...`,
        "info"
      );
      return;
    }

    const newComments = rawComments
      .filter((c) => c.id && !this.seenCommentIds.has(c.id))
      .reverse();

    for (const c of newComments) {
      this.seenCommentIds.add(c.id);
      if (this.seenCommentIds.size > 2000) {
        const first = this.seenCommentIds.values().next().value;
        if (first) this.seenCommentIds.delete(first);
      }

      const message = (c.message || "").trim();
      if (!message) {
        continue;
      }

      const username = c.from?.name?.trim() || "Khách xem live";
      const timestamp = c.created_time ? new Date(c.created_time).getTime() : Date.now();

      this.events.onComment({
        id: c.id,
        username,
        text: message,
        createdTime: c.created_time || new Date().toISOString(),
        timestamp,
      });
    }
  }
}
