import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSourceWindow } from "../src/windows/source-window";

const mockSetPermissionCheckHandler = vi.fn();
const mockSetPermissionRequestHandler = vi.fn();
const mockSetAudioMuted = vi.fn();
const mockSetWindowOpenHandler = vi.fn();
const mockOn = vi.fn();
const mockLoadURL = vi.fn();

vi.mock("electron", () => {
  return {
    session: {
      fromPartition: vi.fn(() => ({
        setPermissionCheckHandler: mockSetPermissionCheckHandler,
        setPermissionRequestHandler: mockSetPermissionRequestHandler,
      })),
    },
    BrowserWindow: vi.fn(function MockBrowserWindow() {
      return {
        webContents: {
          setAudioMuted: mockSetAudioMuted,
          setWindowOpenHandler: mockSetWindowOpenHandler,
          on: mockOn,
        },
        loadURL: mockLoadURL,
      };
    }),
  };
});

describe("source-window permission and security policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("configures deny-by-default for permission check handler", () => {
    createSourceWindow("facebook", "https://www.facebook.com/watch/live/");

    expect(mockSetPermissionCheckHandler).toHaveBeenCalledTimes(1);
    const checkHandler = mockSetPermissionCheckHandler.mock.calls[0][0];
    expect(typeof checkHandler).toBe("function");

    // Must return false for any permission check
    expect(checkHandler()).toBe(false);
    expect(checkHandler(null, "media", "https://www.facebook.com", {})).toBe(false);
    expect(checkHandler(null, "geolocation", "https://www.facebook.com", {})).toBe(false);
  });

  it("configures deny-by-default for permission request handler", () => {
    createSourceWindow("tiktok", "https://www.tiktok.com/@shop/live");

    expect(mockSetPermissionRequestHandler).toHaveBeenCalledTimes(1);
    const requestHandler = mockSetPermissionRequestHandler.mock.calls[0][0];
    expect(typeof requestHandler).toBe("function");

    // Must call callback(false)
    const callback = vi.fn();
    requestHandler(null, "notifications", callback);
    expect(callback).toHaveBeenCalledWith(false);
  });

  it("rejects invalid URLs before window creation", () => {
    expect(() => {
      createSourceWindow("facebook", "https://evil.com/live");
    }).toThrow(/not allowed/i);

    expect(mockSetPermissionCheckHandler).not.toHaveBeenCalled();
  });
});
