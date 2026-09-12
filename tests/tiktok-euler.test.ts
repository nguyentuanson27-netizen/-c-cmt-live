import { describe, expect, it } from "vitest";
import {
  buildEulerWebSocketUrl,
  extractTikTokUniqueId,
  parseEulerMessageBundle,
  sanitizeEulerError,
} from "../src/server/tiktok-euler";

describe("TikTok Euler provider boundary", () => {
  it("parses bounded creator usernames and canonical TikTok LIVE URLs", () => {
    expect(extractTikTokUniqueId("creator_name")).toBe("creator_name");
    expect(extractTikTokUniqueId("@creator.name")).toBe("creator.name");
    expect(
      extractTikTokUniqueId("https://www.tiktok.com/@Creator_01/live?lang=vi-VN"),
    ).toBe("Creator_01");

    expect(extractTikTokUniqueId("https://evil.example/@creator/live")).toBeNull();
    expect(extractTikTokUniqueId("https://www.tiktok.com/@creator/video/123")).toBeNull();
    expect(extractTikTokUniqueId("bad creator name")).toBeNull();
    expect(extractTikTokUniqueId(`@${"a".repeat(65)}`)).toBeNull();
  });

  it("builds only the fixed Euler websocket URL with explicit decoded schema v2", () => {
    const url = new URL(buildEulerWebSocketUrl("Creator_01", "secret-key"));

    expect(url.protocol).toBe("wss:");
    expect(url.hostname).toBe("ws.eulerstream.com");
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("uniqueId")).toBe("Creator_01");
    expect(url.searchParams.get("apiKey")).toBe("secret-key");
    expect(url.searchParams.get("schemaVersion")).toBe("v2");
    expect(url.searchParams.get("features.bundleEvents")).toBe("true");
    expect(url.searchParams.get("features.rawMessages")).toBe("false");
    expect(url.searchParams.get("features.normalizeUniqueId")).toBe("true");
  });

  it("extracts only valid chat messages from a decoded provider bundle", () => {
    const comments = parseEulerMessageBundle(
      JSON.stringify({
        timestamp: 1_789_000_000_000,
        messages: [
          { type: "roomInfo", data: { roomId: "1" } },
          {
            type: "WebcastChatMessage",
            data: {
              common: { msgId: "101", createTime: "1789000000001" },
              user: { uniqueId: "alice", nickname: "Alice" },
              comment: "xin chao",
            },
          },
          {
            type: "WebcastChatMessage",
            data: {
              common: { msgId: "102" },
              user: { displayId: "bob" },
              content: "co size M khong?",
            },
          },
          { type: "WebcastGiftMessage", data: { user: { uniqueId: "gifter" } } },
          { type: "WebcastChatMessage", data: { user: {}, comment: "missing user" } },
        ],
      }),
    );

    expect(comments).toEqual([
      {
        id: "101",
        username: "alice",
        text: "xin chao",
        timestamp: 1_789_000_000_001,
      },
      {
        id: "102",
        username: "bob",
        text: "co size M khong?",
        timestamp: 1_789_000_000_000,
      },
    ]);
  });

  it("bounds bundle work and ignores malformed payloads", () => {
    expect(parseEulerMessageBundle("not json")).toEqual([]);
    expect(parseEulerMessageBundle(JSON.stringify({ messages: {} }))).toEqual([]);

    const messages = Array.from({ length: 250 }, (_, index) => ({
      type: "WebcastChatMessage",
      data: {
        common: { msgId: String(index + 1) },
        user: { nickname: `user-${index}` },
        comment: `comment-${index}`,
      },
    }));

    expect(parseEulerMessageBundle(JSON.stringify({ timestamp: 123, messages }))).toHaveLength(200);
  });

  it("redacts the full API key before bounding provider error text", () => {
    const key = `key-${"x".repeat(500)}`;
    const sanitized = sanitizeEulerError(`provider failed with ${key} and details`, key);

    expect(sanitized).not.toContain("key-");
    expect(sanitized).toContain("[REDACTED]");
    expect(sanitized.length).toBeLessThanOrEqual(300);
  });
});
