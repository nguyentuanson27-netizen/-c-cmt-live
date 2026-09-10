import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSourceWindow } from "../src/windows/source-window";

const mockSetPermissionCheckHandler = vi.fn();
const mockSetPermissionRequestHandler = vi.fn();
const mockSetAudioMuted = vi.fn();
const mockSetWindowOpenHandler = vi.fn();
const mockOn = vi.fn();
const mockLoadURL = vi.fn();
const mockFromPartition = vi.fn(() => ({
  setPermissionCheckHandler: mockSetPermissionCheckHandler,
  setPermissionRequestHandler: mockSetPermissionRequestHandler,
}));
const mockBrowserWindow = vi.fn(function MockBrowserWindow() {
  return {
    webContents: {
      setAudioMuted: mockSetAudioMuted,
      setWindowOpenHandler: mockSetWindowOpenHandler,
      on: mockOn,
    },
    loadURL: mockLoadURL,
  };
});

vi.mock("electron", () => ({
  session: {
    fromPartition: mockFromPartition,
  },
  BrowserWindow: mockBrowserWindow,
}));

describe("source-window security and session policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the platform persistent partition and secure BrowserWindow options", () => {
    createSourceWindow("tiktok", "https://www.tiktok.com/@shop/live");

    expect(mockFromPartition).toHaveBeenCalledWith("persist:tiktok");
    expect(mockBrowserWindow).toHaveBeenCalledWith(
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

    expect(mockSetPermissionCheckHandler).toHaveBeenCalledTimes(1);
    const checkHandler = mockSetPermissionCheckHandler.mock.calls[0][0];
    expect(typeof checkHandler).toBe("function");
    expect(checkHandler()).toBe(false);
    expect(checkHandler(null, "media", "https://www.facebook.com", {})).toBe(false);
    expect(checkHandler(null, "geolocation", "https://www.facebook.com", {})).toBe(false);

    expect(mockSetPermissionRequestHandler).toHaveBeenCalledTimes(1);
    const requestHandler = mockSetPermissionRequestHandler.mock.calls[0][0];
    const callback = vi.fn();
    requestHandler(null, "notifications", callback);
    expect(callback).toHaveBeenCalledWith(false);
  });

  it("mutes source audio and denies popup windows", () => {
    createSourceWindow("shopee", "https://live.shopee.vn/share?from=live");

    expect(mockSetAudioMuted).toHaveBeenCalledWith(true);
    expect(mockSetWindowOpenHandler).toHaveBeenCalledTimes(1);

    const popupHandler = mockSetWindowOpenHandler.mock.calls[0][0];
    expect(popupHandler()).toEqual({ action: "deny" });
  });

  it("blocks navigation and redirects outside the selected platform", () => {
    createSourceWindow("facebook", "https://www.facebook.com/watch/live/");

    const navigateCall = mockOn.mock.calls.find(([eventName]) => eventName === "will-navigate");
    const redirectCall = mockOn.mock.calls.find(([eventName]) => eventName === "will-redirect");

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

    expect(mockLoadURL).toHaveBeenCalledWith("https://www.tiktok.com/@shop/live");
  });

  it("rejects invalid URLs before creating a session or window", () => {
    expect(() => {
      createSourceWindow("facebook", "https://evil.com/live");
    }).toThrow(/not allowed/i);

    expect(mockFromPartition).not.toHaveBeenCalled();
    expect(mockBrowserWindow).not.toHaveBeenCalled();
  });
});
