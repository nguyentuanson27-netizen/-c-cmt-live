import { describe, expect, it } from "vitest";
import {
  TikTokEulerSession,
  type TikTokEulerSocket,
  type TikTokEulerSocketEventMap,
} from "../src/server/tiktok-euler-session";

class FakeSocket implements TikTokEulerSocket {
  public readonly listeners = new Map<keyof TikTokEulerSocketEventMap, Set<(event: never) => void>>();
  public closeCalls: Array<{ code?: number; reason?: string }> = [];

  public addEventListener<K extends keyof TikTokEulerSocketEventMap>(
    type: K,
    listener: (event: TikTokEulerSocketEventMap[K]) => void,
  ): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener as (event: never) => void);
    this.listeners.set(type, listeners);
  }

  public close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
  }

  public emit<K extends keyof TikTokEulerSocketEventMap>(
    type: K,
    event: TikTokEulerSocketEventMap[K],
  ): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event as never);
    }
  }
}

function makeHarness() {
  const sockets: FakeSocket[] = [];
  const urls: string[] = [];
  const timers: Array<{ delay: number; callback: () => void; cancelled: boolean }> = [];
  const statuses: string[] = [];
  const comments: string[] = [];

  const session = new TikTokEulerSession({
    webSocketFactory: (url) => {
      urls.push(url);
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    setTimeoutFn: (callback, delay) => {
      const timer = { delay, callback, cancelled: false };
      timers.push(timer);
      return timer;
    },
    clearTimeoutFn: (timer) => {
      (timer as (typeof timers)[number]).cancelled = true;
    },
  });

  const events = {
    onComment: (_creator: string, comment: { text: string }) => comments.push(comment.text),
    onStatus: (_creator: string, message: string) => statuses.push(message),
  };

  return { session, sockets, urls, timers, statuses, comments, events };
}

describe("TikTok Euler session lifecycle", () => {
  it("starts one session, resolves on open, and rejects a conflicting start", async () => {
    const h = makeHarness();
    const first = h.session.start({ creator: "@alice", apiKey: "secret" }, h.events);

    expect(h.session.connectingCreator).toBe("alice");
    expect(h.urls).toHaveLength(1);
    expect(h.urls[0]).toContain("ws.eulerstream.com");

    const conflict = await h.session.start({ creator: "@bob", apiKey: "secret" }, h.events);
    expect(conflict.ok).toBe(false);
    expect(conflict.error).toMatch(/already active or connecting/i);
    expect(h.sockets).toHaveLength(1);

    h.sockets[0].emit("open", {});
    await expect(first).resolves.toEqual({ ok: true, creator: "alice" });
    expect(h.session.activeCreator).toBe("alice");
    expect(h.session.connectingCreator).toBeNull();
  });

  it("emits comments only from the current generation and stop is idempotent", async () => {
    const h = makeHarness();
    const start = h.session.start({ creator: "alice", apiKey: "secret" }, h.events);
    const socket = h.sockets[0];
    socket.emit("open", {});
    await start;

    socket.emit("message", {
      data: JSON.stringify({
        timestamp: 100,
        messages: [{
          type: "WebcastChatMessage",
          data: { common: { msgId: "1" }, user: { uniqueId: "viewer" }, comment: "first" },
        }],
      }),
    });
    expect(h.comments).toEqual(["first"]);

    expect(h.session.stop()).toBe(true);
    expect(h.session.stop()).toBe(false);
    expect(h.session.activeCreator).toBeNull();
    expect(socket.closeCalls).toEqual([{ code: 1000, reason: "Stopped" }]);

    socket.emit("message", {
      data: JSON.stringify({
        timestamp: 101,
        messages: [{
          type: "WebcastChatMessage",
          data: { common: { msgId: "2" }, user: { uniqueId: "viewer" }, comment: "stale" },
        }],
      }),
    });
    expect(h.comments).toEqual(["first"]);
  });

  it("does not reconnect terminal auth/offline/end closes", async () => {
    for (const code of [4005, 4400, 4401, 4403, 4404]) {
      const h = makeHarness();
      const start = h.session.start({ creator: "alice", apiKey: "secret" }, h.events);
      h.sockets[0].emit("open", {});
      await start;

      h.sockets[0].emit("close", { code, reason: "terminal" });
      expect(h.timers.filter((timer) => !timer.cancelled), `close ${code}`).toHaveLength(0);
      expect(h.session.activeCreator, `close ${code}`).toBeNull();
    }
  });

  it("retries transient closes with bounded exponential backoff and stops after five retries", async () => {
    const h = makeHarness();
    const start = h.session.start({ creator: "alice", apiKey: "secret" }, h.events);
    h.sockets[0].emit("open", {});
    await start;

    const expectedDelays = [1000, 2000, 4000, 8000, 16000];
    for (let retry = 0; retry < expectedDelays.length; retry += 1) {
      h.sockets[retry].emit("close", { code: 1011, reason: "upstream" });
      const timer = h.timers[h.timers.length - 1];
      expect(timer.delay).toBe(expectedDelays[retry]);
      expect(timer.cancelled).toBe(false);
      timer.callback();
      expect(h.sockets).toHaveLength(retry + 2);
      h.sockets[retry + 1].emit("open", {});
    }

    h.sockets[5].emit("close", { code: 1011, reason: "still failing" });
    expect(h.timers).toHaveLength(5);
    expect(h.session.activeCreator).toBeNull();
  });

  it("redacts the API key from provider close status", async () => {
    const h = makeHarness();
    const key = "super-secret-euler-key";
    const start = h.session.start({ creator: "alice", apiKey: key }, h.events);
    h.sockets[0].emit("open", {});
    await start;

    h.sockets[0].emit("close", { code: 4401, reason: `invalid ${key}` });
    expect(h.statuses.join("\n")).not.toContain(key);
  });
});
