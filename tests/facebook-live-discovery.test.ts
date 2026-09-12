import { describe, expect, it, vi } from "vitest";
import type { GraphFetch } from "../src/server/facebook-graph";
import { discoverFacebookLiveVideos } from "../src/server/facebook-live-discovery";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Facebook Page live discovery", () => {
  it("queries the configured Page live edge with a live-only bounded request and header-only token", async () => {
    const fetchFn = vi.fn<GraphFetch>().mockResolvedValue(jsonResponse({ data: [] }));

    const result = await discoverFacebookLiveVideos(
      { token: "SECRET_PAGE_TOKEN", apiVersion: "v99.0", limit: 25 },
      { fetchFn },
    );

    expect(result).toEqual({ ok: true, lives: [] });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const [input, init] = fetchFn.mock.calls[0];
    const url = new URL(String(input));
    expect(url.origin).toBe("https://graph.facebook.com");
    expect(url.pathname).toBe("/v99.0/me/live_videos");
    expect(url.searchParams.get("broadcast_status")).toBe("LIVE");
    expect(url.searchParams.get("fields")).toBe("id,title,status,creation_time");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(String(input)).not.toContain("SECRET_PAGE_TOKEN");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer SECRET_PAGE_TOKEN");
  });

  it("drops malformed entries, bounds external strings, and caps the browser-safe result set", async () => {
    const data = [
      { id: "not-numeric", title: "bad" },
      ...Array.from({ length: 30 }, (_, index) => ({
        id: String(1000 + index),
        title: index === 0 ? `  ${"x".repeat(500)}  ` : `Live ${index}`,
        status: `  ${"S".repeat(100)}  `,
        creation_time: `  2026-09-12T09:00:${String(index).padStart(2, "0")}Z  `,
      })),
    ];
    const fetchFn = vi.fn<GraphFetch>().mockResolvedValue(jsonResponse({ data }));

    const result = await discoverFacebookLiveVideos(
      { token: "TOKEN", apiVersion: "v99.0", limit: 99 },
      { fetchFn },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.lives).toHaveLength(25);
    expect(result.lives.every((live) => /^\d+$/.test(live.id))).toBe(true);
    expect(result.lives[0]).toEqual(
      expect.objectContaining({
        id: "1000",
        title: "x".repeat(200),
        status: "S".repeat(64),
        createdTime: "2026-09-12T09:00:00Z",
      }),
    );

    const requestedUrl = new URL(String(fetchFn.mock.calls[0][0]));
    expect(requestedUrl.searchParams.get("limit")).toBe("25");
  });

  it("returns a sanitized invalid-or-expired error for Graph code 190", async () => {
    const fetchFn = vi.fn<GraphFetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 190,
            message: "Error validating access token: Session has expired",
          },
        },
        400,
      ),
    );

    const result = await discoverFacebookLiveVideos(
      { token: "DO_NOT_EXPOSE", apiVersion: "v99.0" },
      { fetchFn },
    );

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("invalid or expired"),
    });
    if (!result.ok) {
      expect(result.error).not.toContain("DO_NOT_EXPOSE");
    }
  });
});
