import { describe, expect, it, vi } from "vitest";
import {
  FacebookGraphCommentPoller,
  extractFacebookLiveVideoId,
  type GraphFetch,
} from "../src/server/facebook-graph";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Facebook Graph web connector", () => {
  it("extracts Live Video IDs only from numeric input or Facebook video URLs", () => {
    expect(extractFacebookLiveVideoId("123456789012345")).toBe("123456789012345");
    expect(
      extractFacebookLiveVideoId("https://www.facebook.com/example/videos/998877665544332/"),
    ).toBe("998877665544332");
    expect(
      extractFacebookLiveVideoId("https://www.facebook.com/watch/live/?v=112233445566778"),
    ).toBe("112233445566778");
    expect(extractFacebookLiveVideoId("https://evil.example/videos/998877665544332")).toBeNull();
    expect(extractFacebookLiveVideoId("https://facebook.com/example/posts/998877665544332")).toBeNull();
  });

  it("sends the Page token only in the Authorization header", async () => {
    const fetchFn = vi.fn<GraphFetch>().mockResolvedValue(
      jsonResponse({ data: [], paging: { cursors: {} } }),
    );
    const poller = new FacebookGraphCommentPoller({ fetchFn });

    const result = await poller.start(
      {
        token: "SECRET_PAGE_TOKEN",
        apiVersion: "v99.0",
        liveVideoIdOrUrl: "1234567890",
        pollIntervalMs: 60_000,
      },
      { onComment: vi.fn(), onStatus: vi.fn() },
    );

    expect(result.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).not.toContain("SECRET_PAGE_TOKEN");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer SECRET_PAGE_TOKEN");
    poller.stop();
  });

  it("baselines existing comments and emits only comments received after connect", async () => {
    const fetchFn = vi
      .fn<GraphFetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { id: "old-2", from: { name: "Old B" }, message: "old two", created_time: "2026-09-11T10:00:02Z" },
            { id: "old-1", from: { name: "Old A" }, message: "old one", created_time: "2026-09-11T10:00:01Z" },
          ],
          paging: { cursors: {} },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { id: "new-1", from: { name: "Viewer" }, message: "hello live", created_time: "2026-09-11T10:00:03Z" },
            { id: "old-2", from: { name: "Old B" }, message: "old two", created_time: "2026-09-11T10:00:02Z" },
          ],
          paging: { cursors: {} },
        }),
      );
    const onComment = vi.fn();
    const poller = new FacebookGraphCommentPoller({ fetchFn });

    await poller.start(
      { token: "TOKEN", apiVersion: "v99.0", liveVideoIdOrUrl: "1234567890", pollIntervalMs: 60_000 },
      { onComment, onStatus: vi.fn() },
    );
    await poller.pollNow();

    expect(onComment).toHaveBeenCalledTimes(1);
    expect(onComment).toHaveBeenCalledWith(
      expect.objectContaining({ id: "new-1", username: "Viewer", text: "hello live" }),
    );
    poller.stop();
  });

  it("paginates through a burst until the previous boundary and emits all new comments oldest first", async () => {
    const fetchFn = vi
      .fn<GraphFetch>()
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: "boundary", from: { name: "Before" }, message: "before", created_time: "2026-09-11T10:00:00Z" }], paging: { cursors: {} } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { id: "new-4", from: { name: "D" }, message: "4", created_time: "2026-09-11T10:00:04Z" },
            { id: "new-3", from: { name: "C" }, message: "3", created_time: "2026-09-11T10:00:03Z" },
          ],
          paging: { cursors: { after: "cursor-1" } },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { id: "new-2", from: { name: "B" }, message: "2", created_time: "2026-09-11T10:00:02Z" },
            { id: "new-1", from: { name: "A" }, message: "1", created_time: "2026-09-11T10:00:01Z" },
            { id: "boundary", from: { name: "Before" }, message: "before", created_time: "2026-09-11T10:00:00Z" },
          ],
          paging: { cursors: {} },
        }),
      );
    const seen: string[] = [];
    const poller = new FacebookGraphCommentPoller({ fetchFn });

    await poller.start(
      { token: "TOKEN", apiVersion: "v99.0", liveVideoIdOrUrl: "1234567890", pollIntervalMs: 60_000, pageSize: 2 },
      { onComment: (comment) => seen.push(comment.id), onStatus: vi.fn() },
    );
    await poller.pollNow();

    expect(seen).toEqual(["new-1", "new-2", "new-3", "new-4"]);
    expect(String(fetchFn.mock.calls[2][0])).toContain("after=cursor-1");
    poller.stop();
  });

  it("does not let stale in-flight work from a previous run mutate the restarted connector", async () => {
    let resolveFirst!: (value: Response) => void;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchFn = vi
      .fn<GraphFetch>()
      .mockImplementationOnce(() => firstResponse)
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: "b-boundary", from: { name: "B" }, message: "baseline B", created_time: "2026-09-11T10:00:00Z" }], paging: { cursors: {} } }),
      );
    const onCommentA = vi.fn();
    const onCommentB = vi.fn();
    const poller = new FacebookGraphCommentPoller({ fetchFn });

    const startA = poller.start(
      { token: "TOKEN-A", apiVersion: "v99.0", liveVideoIdOrUrl: "111", pollIntervalMs: 60_000 },
      { onComment: onCommentA, onStatus: vi.fn() },
    );
    const startB = poller.start(
      { token: "TOKEN-B", apiVersion: "v99.0", liveVideoIdOrUrl: "222", pollIntervalMs: 60_000 },
      { onComment: onCommentB, onStatus: vi.fn() },
    );

    resolveFirst(
      jsonResponse({ data: [{ id: "a-old", from: { name: "A" }, message: "stale A", created_time: "2026-09-11T09:59:59Z" }], paging: { cursors: {} } }),
    );
    await Promise.all([startA, startB]);

    expect(poller.activeLiveVideoId).toBe("222");
    expect(onCommentA).not.toHaveBeenCalled();
    expect(onCommentB).not.toHaveBeenCalled();
    poller.stop();
  });

  it("returns the token-expired error when the initial Graph request gets code 190", async () => {
    const fetchFn = vi.fn<GraphFetch>().mockResolvedValue(
      jsonResponse(
        { error: { code: 190, message: "Error validating access token: Session has expired" } },
        400,
      ),
    );
    const onStatus = vi.fn();
    const poller = new FacebookGraphCommentPoller({ fetchFn });

    const result = await poller.start(
      { token: "EXPIRED", apiVersion: "v99.0", liveVideoIdOrUrl: "1234567890" },
      { onComment: vi.fn(), onStatus },
    );

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("invalid or expired"),
    });
    expect(poller.isActive).toBe(false);
    expect(poller.activeLiveVideoId).toBeNull();
    expect(onStatus).toHaveBeenCalledWith(
      expect.stringContaining("invalid or expired"),
      "error",
    );
  });
});
