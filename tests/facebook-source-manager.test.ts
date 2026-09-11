import { describe, expect, it, vi } from "vitest";
import { FacebookSourceManager } from "../src/connectors/facebook/manager";
import type { SourceWindow } from "../src/windows/source-window";

type FakeSource = {
  source: SourceWindow;
  close: ReturnType<typeof vi.fn>;
  emitClosed: () => void;
};

function fakeSource(id: number, url: string): FakeSource {
  const closedListeners: Array<() => void> = [];
  let destroyed = false;
  const close = vi.fn(() => {
    destroyed = true;
    closedListeners.forEach((listener) => listener());
  });

  const source = {
    platform: "facebook" as const,
    url,
    window: {
      id,
      isDestroyed: () => destroyed,
      close,
      on: (eventName: string, listener: () => void) => {
        if (eventName === "closed") {
          closedListeners.push(listener);
        }
      },
      webContents: {
        id: id + 1000,
      },
    },
  } as unknown as SourceWindow;

  return {
    source,
    close,
    emitClosed: () => {
      destroyed = true;
      closedListeners.forEach((listener) => listener());
    },
  };
}

describe("FacebookSourceManager", () => {
  it("keeps multiple Facebook sources open at the same time", () => {
    const created = [
      fakeSource(1, "https://www.facebook.com/page-a/videos/1"),
      fakeSource(2, "https://www.facebook.com/page-b/videos/2"),
    ];
    const createSource = vi.fn(() => created.shift()!.source);
    const manager = new FacebookSourceManager(createSource);

    const first = manager.open("https://www.facebook.com/page-a/videos/1");
    const second = manager.open("https://www.facebook.com/page-b/videos/2");

    expect(first.id).toBe("1");
    expect(second.id).toBe("2");
    expect(manager.list()).toHaveLength(2);
    expect(createSource).toHaveBeenCalledTimes(2);
  });

  it("closes one source without affecting the others", () => {
    const first = fakeSource(10, "https://www.facebook.com/page-a/videos/1");
    const second = fakeSource(20, "https://www.facebook.com/page-b/videos/2");
    const created = [first, second];
    const manager = new FacebookSourceManager(() => created.shift()!.source);

    manager.open(first.source.url);
    manager.open(second.source.url);

    expect(manager.close("10")).toBe(true);
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).not.toHaveBeenCalled();
    expect(manager.list().map((source) => source.id)).toEqual(["20"]);
  });

  it("removes a source that closes independently while keeping other sources registered", () => {
    const first = fakeSource(3, "https://www.facebook.com/page-a/videos/1");
    const second = fakeSource(4, "https://www.facebook.com/page-b/videos/2");
    const created = [first, second];
    const manager = new FacebookSourceManager(() => created.shift()!.source);

    manager.open(first.source.url);
    manager.open(second.source.url);
    first.emitClosed();

    expect(manager.list().map((source) => source.id)).toEqual(["4"]);
    expect(second.close).not.toHaveBeenCalled();
  });

  it("finds the source that owns an IPC sender", () => {
    const first = fakeSource(7, "https://www.facebook.com/page-a/videos/1");
    const second = fakeSource(8, "https://www.facebook.com/page-b/videos/2");
    const created = [first, second];
    const manager = new FacebookSourceManager(() => created.shift()!.source);

    manager.open(first.source.url);
    manager.open(second.source.url);

    expect(manager.findByWebContentsId(1008)?.id).toBe("8");
    expect(manager.findByWebContentsId(9999)).toBeNull();
  });

  it("enforces the configured source limit before creating another window", () => {
    const createSource = vi
      .fn()
      .mockReturnValueOnce(fakeSource(1, "https://www.facebook.com/page-a/videos/1").source)
      .mockReturnValueOnce(fakeSource(2, "https://www.facebook.com/page-b/videos/2").source);
    const manager = new FacebookSourceManager(createSource, 2);

    manager.open("https://www.facebook.com/page-a/videos/1");
    manager.open("https://www.facebook.com/page-b/videos/2");

    expect(() => manager.open("https://www.facebook.com/page-c/videos/3")).toThrow(/maximum.*2/i);
    expect(createSource).toHaveBeenCalledTimes(2);
  });

  it("defaults to a maximum of 9 concurrent sources", () => {
    const fakes = Array.from({ length: 9 }, (_, i) =>
      fakeSource(i + 1, `https://www.facebook.com/page/videos/${i + 1}`),
    );
    const createSource = vi.fn(() => fakes.shift()!.source);
    const manager = new FacebookSourceManager(createSource);

    for (let i = 1; i <= 9; i++) {
      manager.open(`https://www.facebook.com/page/videos/${i}`);
    }

    expect(manager.count()).toBe(9);
    expect(() => manager.open("https://www.facebook.com/page/videos/10")).toThrow(/maximum.*9/i);
    expect(createSource).toHaveBeenCalledTimes(9);
  });

  it("does not corrupt existing registry when source creation throws an error", () => {
    const valid = fakeSource(1, "https://www.facebook.com/page-a/videos/1");
    const createSource = vi.fn((url: string) => {
      if (url.includes("invalid")) {
        throw new Error("Invalid platform URL");
      }
      return valid.source;
    });
    const manager = new FacebookSourceManager(createSource);

    manager.open("https://www.facebook.com/page-a/videos/1");
    expect(manager.count()).toBe(1);

    expect(() => manager.open("https://www.facebook.com/invalid")).toThrow("Invalid platform URL");
    expect(manager.count()).toBe(1);
    expect(manager.list().map((s) => s.id)).toEqual(["1"]);
  });

  it("returns false and leaves registry unchanged when closing an unknown id", () => {
    const valid = fakeSource(5, "https://www.facebook.com/page-a/videos/5");
    const manager = new FacebookSourceManager(() => valid.source);

    manager.open(valid.source.url);
    expect(manager.close("999")).toBe(false);
    expect(manager.count()).toBe(1);
  });

  it("closes all sources and empties registry on closeAll", () => {
    const first = fakeSource(1, "https://www.facebook.com/page-a/videos/1");
    const second = fakeSource(2, "https://www.facebook.com/page-b/videos/2");
    const created = [first, second];
    const manager = new FacebookSourceManager(() => created.shift()!.source);

    manager.open(first.source.url);
    manager.open(second.source.url);
    expect(manager.count()).toBe(2);

    manager.closeAll();
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).toHaveBeenCalledTimes(1);
    expect(manager.count()).toBe(0);
    expect(manager.list()).toHaveLength(0);
  });

  it("handles close safely when window is already destroyed", () => {
    const first = fakeSource(1, "https://www.facebook.com/page-a/videos/1");
    const manager = new FacebookSourceManager(() => first.source);

    manager.open(first.source.url);
    first.emitClosed(); // marks destroyed
    expect(manager.count()).toBe(0);

    // closing already removed/destroyed source returns false
    expect(manager.close("1")).toBe(false);
  });
});

