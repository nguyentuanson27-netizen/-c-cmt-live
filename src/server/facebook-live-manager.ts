import {
  FacebookGraphCommentPoller,
  extractFacebookLiveVideoId,
  type FacebookGraphComment,
  type FacebookGraphConfig,
  type FacebookGraphEvents,
} from "./facebook-graph";

type StartResult = { ok: boolean; liveVideoId?: string; error?: string };

type ManagedPoller = {
  readonly isActive: boolean;
  readonly activeLiveVideoId: string | null;
  start(config: FacebookGraphConfig, events: FacebookGraphEvents): Promise<StartResult>;
  stop(): void;
};

export type FacebookMultiLiveEvents = {
  onComment: (liveVideoId: string, comment: FacebookGraphComment) => void;
  onStatus: (liveVideoId: string, message: string, level: "info" | "error") => void;
};

type FacebookLiveManagerOptions = {
  maxLives?: number;
  pollerFactory?: () => ManagedPoller;
};

export class FacebookLiveManager {
  private readonly maxLives: number;
  private readonly pollerFactory: () => ManagedPoller;
  private readonly activePollers = new Map<string, ManagedPoller>();
  private readonly pendingPollers = new Map<string, ManagedPoller>();

  constructor(options?: FacebookLiveManagerOptions) {
    this.maxLives = Math.min(9, Math.max(1, Math.floor(options?.maxLives ?? 9)));
    this.pollerFactory = options?.pollerFactory ?? (() => new FacebookGraphCommentPoller());
  }

  public get activeLiveIds(): string[] {
    return [...this.activePollers.keys()];
  }

  public get activeCount(): number {
    return this.activePollers.size;
  }

  public get pendingCount(): number {
    return this.pendingPollers.size;
  }

  public async startLive(
    config: FacebookGraphConfig,
    events: FacebookMultiLiveEvents,
  ): Promise<StartResult> {
    const liveVideoId = extractFacebookLiveVideoId(config.liveVideoIdOrUrl);
    if (!liveVideoId) {
      return { ok: false, error: "Invalid Facebook Live video ID or URL" };
    }

    if (this.activePollers.has(liveVideoId) || this.pendingPollers.has(liveVideoId)) {
      return { ok: false, error: `Facebook Live ${liveVideoId} is already active or connecting` };
    }

    if (this.activePollers.size + this.pendingPollers.size >= this.maxLives) {
      return { ok: false, error: `Maximum ${this.maxLives} Facebook Lives can be active or connecting` };
    }

    const poller = this.pollerFactory();
    this.pendingPollers.set(liveVideoId, poller);

    const wrappedEvents: FacebookGraphEvents = {
      onComment: (comment) => events.onComment(liveVideoId, comment),
      onStatus: (message, level) => {
        events.onStatus(liveVideoId, message, level);
        if (!poller.isActive && this.activePollers.get(liveVideoId) === poller) {
          this.activePollers.delete(liveVideoId);
        }
      },
    };

    try {
      const result = await poller.start(
        { ...config, liveVideoIdOrUrl: liveVideoId },
        wrappedEvents,
      );

      if (result.ok && this.pendingPollers.get(liveVideoId) === poller) {
        this.activePollers.set(liveVideoId, poller);
      }
      return result;
    } finally {
      if (this.pendingPollers.get(liveVideoId) === poller) {
        this.pendingPollers.delete(liveVideoId);
      }
    }
  }

  public stopLive(liveVideoId: string): boolean {
    const normalized = liveVideoId.trim();
    const active = this.activePollers.get(normalized);
    if (active) {
      active.stop();
      this.activePollers.delete(normalized);
      return true;
    }

    const pending = this.pendingPollers.get(normalized);
    if (pending) {
      pending.stop();
      this.pendingPollers.delete(normalized);
      return true;
    }

    return false;
  }

  public stopAll(): void {
    const pollers = new Set<ManagedPoller>([
      ...this.activePollers.values(),
      ...this.pendingPollers.values(),
    ]);
    this.activePollers.clear();
    this.pendingPollers.clear();
    for (const poller of pollers) {
      poller.stop();
    }
  }
}
