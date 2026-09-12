import { describe, expect, it, vi } from "vitest";
import type {
  FacebookGraphComment,
  FacebookGraphConfig,
  FacebookGraphEvents,
} from "../src/server/facebook-graph";
import { FacebookLiveManager } from "../src/server/facebook-live-manager";

type StartResult = { ok: boolean; liveVideoId?: string; error?: string };

class FakePoller {
  public active = false;
  public liveVideoId: string | null = null;
  public stopped = false;
  public events: FacebookGraphEvents | null = null;
  public startImpl: (config: FacebookGraphConfig) => Promise<StartResult> = async (config) => ({
    ok: true,
    liveVideoId: config.liveVideoIdOrUrl,
  });

  public get isActive(): boolean {
    return this.active;
  }

  public get activeLiveVideoId(): string | null {
    return this.liveVideoId;
  }

  public async start(config: FacebookGraphConfig, events: FacebookGraphEvents): Promise<StartResult> {
    this.events = events;
    const result = await this.startImpl(config);
    if (result.ok) {
      this.active = true;
      this.liveVideoId = result.liveVideoId ?? config.liveVideoIdOrUrl;
    }
    return result;
  }

  public stop(): void {
    this.stopped = true;
    this.active = false;
    this.liveVideoId = null;
  }

  public expire(message = "expired"): void {
    this.active = false;
    this.liveVideoId = null;
    this.events?.onStatus(message, "error");
  }
}

function config(liveVideoIdOrUrl: string): FacebookGraphConfig {
  return {
    token: "TOKEN",
    apiVersion: "v22.0",
    liveVideoIdOrUrl,
    pollIntervalMs: 60_000,
  };
}

function events() {
  return {
    onComment: vi.fn<(liveVideoId: string, comment: FacebookGraphComment) => void>(),
    onStatus: vi.fn<(liveVideoId: string, message: string, level: "info" | "error") => void>(),
  };
}

describe("FacebookLiveManager", () => {
  it("runs independent live sessions and stops only the requested live", async () => {
    const pollers: FakePoller[] = [];
    const manager = new FacebookLiveManager({
      pollerFactory: () => {
        const poller = new FakePoller();
        pollers.push(poller);
        return poller;
      },
    });
    const callbacks = events();

    expect((await manager.startLive(config("111"), callbacks)).ok).toBe(true);
    expect((await manager.startLive(config("222"), callbacks)).ok).toBe(true);
    expect(manager.activeLiveIds).toEqual(["111", "222"]);

    expect(manager.stopLive("111")).toBe(true);
    expect(pollers[0].stopped).toBe(true);
    expect(pollers[1].stopped).toBe(false);
    expect(manager.activeLiveIds).toEqual(["222"]);
  });

  it("rejects a duplicate live without creating or disturbing another poller", async () => {
    const factory = vi.fn(() => new FakePoller());
    const manager = new FacebookLiveManager({ pollerFactory: factory });
    const callbacks = events();

    expect((await manager.startLive(config("111"), callbacks)).ok).toBe(true);
    const duplicate = await manager.startLive(config("111"), callbacks);

    expect(duplicate.ok).toBe(false);
    expect(duplicate.error).toMatch(/already active/i);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(manager.activeLiveIds).toEqual(["111"]);
  });

  it("counts pending starts toward the 9-live cap so concurrent starts cannot overbook", async () => {
    const resolvers: Array<(value: StartResult) => void> = [];
    const factory = vi.fn(() => {
      const poller = new FakePoller();
      poller.startImpl = (startConfig) =>
        new Promise<StartResult>((resolve) => {
          resolvers.push((value) => resolve({ ...value, liveVideoId: startConfig.liveVideoIdOrUrl }));
        });
      return poller;
    });
    const manager = new FacebookLiveManager({ pollerFactory: factory, maxLives: 9 });
    const callbacks = events();

    const pending = Array.from({ length: 9 }, (_, index) =>
      manager.startLive(config(String(100 + index)), callbacks),
    );
    const tenth = await manager.startLive(config("999"), callbacks);

    expect(tenth.ok).toBe(false);
    expect(tenth.error).toMatch(/maximum.*9/i);
    expect(factory).toHaveBeenCalledTimes(9);

    resolvers.forEach((resolve) => resolve({ ok: true }));
    await Promise.all(pending);
    expect(manager.activeLiveIds).toHaveLength(9);
  });

  it("releases a reserved slot after a failed start", async () => {
    const failed = new FakePoller();
    failed.startImpl = async () => ({ ok: false, error: "baseline failed" });
    const good = new FakePoller();
    const pollers = [failed, good];
    const manager = new FacebookLiveManager({
      maxLives: 1,
      pollerFactory: () => pollers.shift()!,
    });
    const callbacks = events();

    expect((await manager.startLive(config("111"), callbacks)).ok).toBe(false);
    expect((await manager.startLive(config("222"), callbacks)).ok).toBe(true);
    expect(manager.activeLiveIds).toEqual(["222"]);
  });

  it("removes only a poller that becomes inactive after its own error status", async () => {
    const pollers: FakePoller[] = [];
    const manager = new FacebookLiveManager({
      pollerFactory: () => {
        const poller = new FakePoller();
        pollers.push(poller);
        return poller;
      },
    });
    const callbacks = events();

    await manager.startLive(config("111"), callbacks);
    await manager.startLive(config("222"), callbacks);
    pollers[0].expire("token expired");

    expect(manager.activeLiveIds).toEqual(["222"]);
    expect(callbacks.onStatus).toHaveBeenCalledWith("111", "token expired", "error");
  });
});
