import { describe, expect, it, vi } from "vitest";
import {
  extractFacebookLiveVideoId,
  FacebookGraphApiConnector,
} from "../src/connectors/facebook/graph-api-connector";

describe("Facebook Graph API Live Video ID extraction", () => {
  it("extracts pure numeric IDs directly", () => {
    expect(extractFacebookLiveVideoId("123456789012345")).toBe("123456789012345");
    expect(extractFacebookLiveVideoId("  9876543210  ")).toBe("9876543210");
  });

  it("extracts video ID from standard /videos/ URLs", () => {
    const url = "https://www.facebook.com/MyPage/videos/998877665544332/";
    expect(extractFacebookLiveVideoId(url)).toBe("998877665544332");
  });

  it("extracts video ID from query param ?v= URLs", () => {
    const url = "https://www.facebook.com/watch/live/?v=112233445566778&ref=watch_permalink";
    expect(extractFacebookLiveVideoId(url)).toBe("112233445566778");
  });

  it("extracts video ID from /live/ URLs", () => {
    const url = "https://www.facebook.com/watch/live/554433221100/";
    expect(extractFacebookLiveVideoId(url)).toBe("554433221100");
  });

  it("extracts video ID from /posts/ URLs", () => {
    const url = "https://www.facebook.com/page.name/posts/77889900112233";
    expect(extractFacebookLiveVideoId(url)).toBe("77889900112233");
  });

  it("returns null for empty or invalid input", () => {
    expect(extractFacebookLiveVideoId("")).toBeNull();
    expect(extractFacebookLiveVideoId("   ")).toBeNull();
    expect(extractFacebookLiveVideoId("https://www.google.com")).toBeNull();
  });
});

describe("FacebookGraphApiConnector lifecycle and polling", () => {
  it("validates token input before starting", async () => {
    const connector = new FacebookGraphApiConnector();
    const result = await connector.start(
      { token: "" },
      { onComment: vi.fn(), onStatus: vi.fn() }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Chưa nhập Page Access Token");
    expect(connector.isActive).toBe(false);
  });

  it("baselines initial comments and emits only subsequent comments", async () => {
    const connector = new FacebookGraphApiConnector();
    const onComment = vi.fn();
    const onStatus = vi.fn();

    const mockFetch = vi.fn();
    // First poll: returns initial comments (should be baselined)
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        data: [
          { id: "c1", from: { id: "u1", name: "Nguyễn A" }, message: "Comment 1", created_time: "2026-09-11T12:00:00Z" },
        ],
      }),
    });

    // Second poll: returns initial comment c1 + new comment c2
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        data: [
          { id: "c2", from: { id: "u2", name: "Trần B" }, message: "Comment 2 mới", created_time: "2026-09-11T12:00:05Z" },
          { id: "c1", from: { id: "u1", name: "Nguyễn A" }, message: "Comment 1", created_time: "2026-09-11T12:00:00Z" },
        ],
      }),
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const startRes = await connector.start(
        {
          token: "EAA...",
          liveVideoIdOrUrl: "1234567890",
          pollIntervalMs: 50,
        },
        { onComment, onStatus }
      );

      expect(startRes.ok).toBe(true);
      expect(connector.isActive).toBe(true);
      expect(connector.activeLiveVideoId).toBe("1234567890");

      // Wait a tick for second poll to run
      await new Promise((r) => setTimeout(r, 120));

      connector.stop();
      expect(connector.isActive).toBe(false);

      // Only c2 should be emitted (c1 was baselined)
      expect(onComment).toHaveBeenCalledTimes(1);
      expect(onComment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "c2",
          username: "Trần B",
          text: "Comment 2 mới",
        })
      );
    } finally {
      globalThis.fetch = originalFetch;
      connector.stop();
    }
  });

  it("handles token expiration gracefully without crashing", async () => {
    const connector = new FacebookGraphApiConnector();
    const onComment = vi.fn();
    const onStatus = vi.fn();

    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({
        error: { code: 190, message: "Error validating access token: Session has expired" },
      }),
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      await connector.start(
        {
          token: "EXPIRED_TOKEN",
          liveVideoIdOrUrl: "1234567890",
          pollIntervalMs: 100,
        },
        { onComment, onStatus }
      );

      await new Promise((r) => setTimeout(r, 60));

      expect(connector.isActive).toBe(false);
      expect(onStatus).toHaveBeenCalledWith(
        expect.stringContaining("Token không hợp lệ hoặc đã hết hạn"),
        "error"
      );
    } finally {
      globalThis.fetch = originalFetch;
      connector.stop();
    }
  });
});
