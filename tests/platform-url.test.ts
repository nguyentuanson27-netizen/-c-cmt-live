import { describe, expect, it } from "vitest";
import { isAllowedPlatformUrl, parsePlatformUrl } from "../src/security/platform-url";

describe("platform URL validation", () => {
  it("accepts HTTPS Facebook URLs and subdomains", () => {
    expect(isAllowedPlatformUrl("https://www.facebook.com/page/videos/123", "facebook")).toBe(true);
    expect(isAllowedPlatformUrl("https://m.facebook.com/watch/live/", "facebook")).toBe(true);
  });

  it("rejects cross-platform and lookalike hosts", () => {
    expect(isAllowedPlatformUrl("https://evilfacebook.com/live", "facebook")).toBe(false);
    expect(isAllowedPlatformUrl("https://facebook.com.evil.example/live", "facebook")).toBe(false);
    expect(isAllowedPlatformUrl("https://www.tiktok.com/@shop/live", "facebook")).toBe(false);
  });

  it("rejects non-HTTPS remote URLs", () => {
    expect(isAllowedPlatformUrl("http://www.facebook.com/live", "facebook")).toBe(false);
    expect(isAllowedPlatformUrl("file:///tmp/live.html", "facebook")).toBe(false);
  });

  it("accepts TikTok and Shopee Vietnam hosts for their own modes", () => {
    expect(isAllowedPlatformUrl("https://www.tiktok.com/@shop/live", "tiktok")).toBe(true);
    expect(isAllowedPlatformUrl("https://live.shopee.vn/share?from=live", "shopee")).toBe(true);
  });

  it("normalizes a valid URL and throws for an invalid one", () => {
    expect(parsePlatformUrl(" https://www.tiktok.com/@shop/live ", "tiktok").hostname).toBe("www.tiktok.com");
    expect(() => parsePlatformUrl("https://example.com/live", "tiktok")).toThrow(/not allowed/i);
  });
});
