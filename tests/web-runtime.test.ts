import type { ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import {
  isLoopbackHost,
  loadFacebookServerConfig,
  parseFacebookStartRequest,
  parseFacebookStopRequest,
} from "../src/server/config";
import { SseHub } from "../src/server/events";
import { BrowserPlaybackBridge } from "../src/server/playback-bridge";

describe("web runtime server boundaries", () => {
  it("accepts only loopback bind hosts in the local runtime", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("[::1]")).toBe(true);
    expect(isLoopbackHost("0.0.0.0")).toBe(false);
    expect(isLoopbackHost("192.168.1.10")).toBe(false);
  });

  it("loads Facebook token and API version from server environment only", () => {
    expect(
      loadFacebookServerConfig({
        FACEBOOK_PAGE_ACCESS_TOKEN: "PAGE_SECRET",
        FACEBOOK_GRAPH_API_VERSION: "v99.0",
      }),
    ).toEqual({
      ok: true,
      config: { token: "PAGE_SECRET", apiVersion: "v99.0" },
    });

    expect(loadFacebookServerConfig({ FACEBOOK_PAGE_ACCESS_TOKEN: "PAGE_SECRET" })).toEqual({
      ok: false,
      error: expect.stringContaining("FACEBOOK_GRAPH_API_VERSION"),
    });
  });

  it("rejects browser start payloads that attempt to send a Page token", () => {
    expect(parseFacebookStartRequest({ liveVideoIdOrUrl: "123456789" })).toEqual({
      ok: true,
      liveVideoIdOrUrl: "123456789",
    });
    expect(
      parseFacebookStartRequest({ liveVideoIdOrUrl: "123456789", token: "SHOULD_NOT_BE_HERE" }),
    ).toEqual({
      ok: false,
      error: expect.stringContaining("server"),
    });
    expect(parseFacebookStartRequest({ liveVideoIdOrUrl: "" }).ok).toBe(false);
  });

  it("parses stop-one or stop-all requests without accepting secrets", () => {
    expect(parseFacebookStopRequest({})).toEqual({ ok: true });
    expect(parseFacebookStopRequest(null)).toEqual({ ok: true });
    expect(parseFacebookStopRequest({ liveVideoId: "123456789" })).toEqual({
      ok: true,
      liveVideoId: "123456789",
    });
    expect(parseFacebookStopRequest({ liveVideoId: "not-an-id" }).ok).toBe(false);
    expect(parseFacebookStopRequest({ token: "SHOULD_NOT_BE_HERE" }).ok).toBe(false);
  });
});

describe("SSE delivery", () => {
  it("sends playback to only one connected browser and transfers ownership after disconnect", () => {
    const hub = new SseHub();
    const first = { write: vi.fn(() => true) } as unknown as ServerResponse;
    const second = { write: vi.fn(() => true) } as unknown as ServerResponse;
    const removeFirst = hub.addClient(first);
    hub.addClient(second);
    first.write = vi.fn(() => true) as typeof first.write;
    second.write = vi.fn(() => true) as typeof second.write;

    expect(hub.broadcastOne({ type: "playback", id: "one" })).toBe(true);
    expect(first.write).toHaveBeenCalledTimes(1);
    expect(second.write).not.toHaveBeenCalled();

    removeFirst();
    expect(hub.broadcastOne({ type: "playback", id: "two" })).toBe(true);
    expect(second.write).toHaveBeenCalledTimes(1);
  });
});

describe("browser playback bridge", () => {
  it("broadcasts one audio item and resolves only for the matching completion id", async () => {
    const broadcast = vi.fn();
    const bridge = new BrowserPlaybackBridge(broadcast, 5_000);

    const resultPromise = bridge.playAudio("comment-1", "BASE64_AUDIO");

    expect(broadcast).toHaveBeenCalledWith({
      type: "playback",
      id: "comment-1",
      mime: "audio/mpeg",
      audioBase64: "BASE64_AUDIO",
    });
    expect(bridge.complete("other-id", true)).toBe(false);
    expect(bridge.complete("comment-1", true)).toBe(true);
    await expect(resultPromise).resolves.toEqual({ success: true });
  });

  it("cancels a pending playback when the browser session is reset", async () => {
    const bridge = new BrowserPlaybackBridge(vi.fn(), 5_000);
    const resultPromise = bridge.playAudio("comment-2", "AUDIO");

    bridge.cancelPending();

    await expect(resultPromise).resolves.toEqual({ success: false });
  });
});
