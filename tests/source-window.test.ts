import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSourceWindow } from "../src/windows/source-window";

const mocks = vi.hoisted(() => {
  const setPermissionCheckHandler = vi.fn();
  const setPermissionRequestHandler = vi.fn();
  const setAudioMuted = vi.fn();
  const setWindowOpenHandler = vi.fn();
  const on = vi.fn();
  const loadURL = vi.fn();
  const fromPartition = vi.fn(() => ({
    setPermissionCheckHandler,
    setPermissionRequestHandler,
  }));
  const BrowserWindow = vi.fn(function MockBrowserWindow() {
    return {
      webContents: {
        setAudioMuted,
        setWindowOpenHandler,
        on,
      },
      loadURL,
    };
  });

  return {
    setPermissionCheckHandler,
    setPermissionRequestHandler,
    setAudioMuted,
    setWindowOpenHandler,
    on,
    loadURL,
    fromPartition,
    BrowserWindow,
  };
});

vi.mock("electron", () => ({
  session: {
    fromPartition: mocks.fromPartition,
  },
  BrowserWindow: mocks.BrowserWindow,
}));

describe("source-window security and session policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the platform persistent partition and secure BrowserWindow options", () => {
    createSourceWindow("tiktok", "https://www.tiktok.com/@shop/live");

    expect(mocks.fromPartition).toHaveBeenCalledWith("persist:tiktok");
    expect(mocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          partition: "persist:tiktok",
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        }),
      }),
    );
  });

  it("denies permissions by default", () => {
    createSourceWindow("facebook", "https://www.facebook.com/watch/live/");

    expect(mocks.setPermissionCheckHandler).toHaveBeenCalledTimes(1);
    const checkHandler = mocks.setPermissionCheckHandler.mock.calls[0][0];
    expect(typeof checkHandler).toBe("function");
    expect(checkHandler()).toBe(false);
    expect(checkHandler(null, "media", "https://www.facebook.com", {})).toBe(false);
    expect(checkHandler(null, "geolocation", "https://www.facebook.com", {})).toBe(false);

    expect(mocks.setPermissionRequestHandler).toHaveBeenCalledTimes(1);
    const requestHandler = mocks.setPermissionRequestHandler.mock.calls[0][0];
    const callback = vi.fn();
    requestHandler(null, "notifications", callback);
    expect(callback).toHaveBeenCalledWith(false);
  });

  it("mutes source audio and denies popup windows", () => {
    createSourceWindow("shopee", "https://live.shopee.vn/share?from=live");

    expect(mocks.setAudioMuted).toHaveBeenCalledWith(true);
    expect(mocks.setWindowOpenHandler).toHaveBeenCalledTimes(1);

    const popupHandler = mocks.setWindowOpenHandler.mock.calls[0][0];
    expect(popupHandler()).toEqual({ action: "deny" });
  });

  it("blocks navigation and redirects outside the selected platform", () => {
    createSourceWindow("facebook", "https://www.facebook.com/watch/live/");

    const navigateCall = mocks.on.mock.calls.find(([eventName]) => eventName === "will-navigate");
    const redirectCall = mocks.on.mock.calls.find(([eventName]) => eventName === "will-redirect");

    expect(navigateCall).toBeDefined();
    expect(redirectCall).toBeDefined();

    const willNavigate = navigateCall?.[1];
    const willRedirect = redirectCall?.[1];
    const preventDefault = vi.fn();

    willNavigate({ preventDefault }, "https://evil.example/live");
    expect(preventDefault).toHaveBeenCalledTimes(1);

    preventDefault.mockClear();
    willNavigate({ preventDefault }, "https://m.facebook.com/watch/live/");
    expect(preventDefault).not.toHaveBeenCalled();

    willRedirect({ preventDefault }, "https://example.com/login");
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("loads the normalized allowed URL", () => {
    createSourceWindow("tiktok", " https://www.tiktok.com/@shop/live ");

    expect(mocks.loadURL).toHaveBeenCalledWith("https://www.tiktok.com/@shop/live");
  });

  it("rejects invalid URLs before creating a session or window", () => {
    expect(() => {
      createSourceWindow("facebook", "https://evil.com/live");
    }).toThrow(/not allowed/i);

    expect(mocks.fromPartition).not.toHaveBeenCalled();
    expect(mocks.BrowserWindow).not.toHaveBeenCalled();
  });
});
