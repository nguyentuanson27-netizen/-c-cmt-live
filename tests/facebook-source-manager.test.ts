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
});
