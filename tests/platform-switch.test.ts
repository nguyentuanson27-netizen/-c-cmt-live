import { describe, expect, it, vi } from "vitest";
import { preparePlatformSwitch } from "../src/windows/platform-switch";
import { FacebookSourceManager } from "../src/connectors/facebook/manager";
import type { SourceWindow } from "../src/windows/source-window";

function fakeSource(id: number, url: string): SourceWindow {
  return {
    platform: "facebook",
    url,
    window: {
      id,
      isDestroyed: () => false,
      close: vi.fn(),
      on: vi.fn(),
      webContents: { id: id + 1000 },
    },
  } as unknown as SourceWindow;
}

describe("platform switch mode isolation", () => {
  it("closes active single source when opening Facebook without closing Facebook sources", () => {
    const closeFacebookSources = vi.fn();
    const closeSingleSource = vi.fn();

    preparePlatformSwitch("facebook", {
      closeFacebookSources,
      closeSingleSource,
    });

    expect(closeSingleSource).toHaveBeenCalledTimes(1);
    expect(closeFacebookSources).not.toHaveBeenCalled();
  });

  it("closes all Facebook sources and active single source when opening TikTok", () => {
    const closeFacebookSources = vi.fn();
    const closeSingleSource = vi.fn();

    preparePlatformSwitch("tiktok", {
      closeFacebookSources,
      closeSingleSource,
    });

    expect(closeFacebookSources).toHaveBeenCalledTimes(1);
    expect(closeSingleSource).toHaveBeenCalledTimes(1);
  });

  it("closes all Facebook sources and active single source when opening Shopee", () => {
    const closeFacebookSources = vi.fn();
    const closeSingleSource = vi.fn();

    preparePlatformSwitch("shopee", {
      closeFacebookSources,
      closeSingleSource,
    });

    expect(closeFacebookSources).toHaveBeenCalledTimes(1);
    expect(closeSingleSource).toHaveBeenCalledTimes(1);
  });

  it("keeps existing Facebook sources when opening a second Facebook live", () => {
    const fakes = [
      fakeSource(1, "https://www.facebook.com/page-a/videos/1"),
      fakeSource(2, "https://www.facebook.com/page-b/videos/2"),
    ];
    const fbManager = new FacebookSourceManager(() => fakes.shift()!);
    const closeSingleSource = vi.fn();

    // Open first Facebook live
    preparePlatformSwitch("facebook", {
      closeFacebookSources: () => fbManager.closeAll(),
      closeSingleSource,
    });
    const first = fbManager.open("https://www.facebook.com/page-a/videos/1");
    expect(fbManager.count()).toBe(1);

    // Open second Facebook live
    preparePlatformSwitch("facebook", {
      closeFacebookSources: () => fbManager.closeAll(),
      closeSingleSource,
    });
    const second = fbManager.open("https://www.facebook.com/page-b/videos/2");

    // Both sources remain active
    expect(fbManager.count()).toBe(2);
    expect(fbManager.list().map((s) => s.id)).toEqual(["1", "2"]);
    expect(first.source.window.close).not.toHaveBeenCalled();
    expect(second.source.window.close).not.toHaveBeenCalled();
  });

  it("closes all Facebook sources when switching from Facebook multi-live to TikTok", () => {
    const fakes = [
      fakeSource(1, "https://www.facebook.com/page-a/videos/1"),
      fakeSource(2, "https://www.facebook.com/page-b/videos/2"),
    ];
    const fbManager = new FacebookSourceManager(() => fakes.shift()!);
    const first = fbManager.open("https://www.facebook.com/page-a/videos/1");
    const second = fbManager.open("https://www.facebook.com/page-b/videos/2");
    expect(fbManager.count()).toBe(2);

    const closeSingleSource = vi.fn();

    // Switch to TikTok
    preparePlatformSwitch("tiktok", {
      closeFacebookSources: () => fbManager.closeAll(),
      closeSingleSource,
    });

    expect(fbManager.count()).toBe(0);
    expect(first.source.window.close).toHaveBeenCalledTimes(1);
    expect(second.source.window.close).toHaveBeenCalledTimes(1);
    expect(closeSingleSource).toHaveBeenCalledTimes(1);
  });
});
