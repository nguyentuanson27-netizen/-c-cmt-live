import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadTikTokServerConfig,
  parseTikTokStartRequest,
  parseTikTokStopRequest,
} from "../src/server/config";

const root = process.cwd();

describe("TikTok web runtime contract", () => {
  it("loads the Euler API key from server environment only", () => {
    expect(loadTikTokServerConfig({ EULER_API_KEY: "  EULER_SECRET  " })).toEqual({
      ok: true,
      config: { apiKey: "EULER_SECRET" },
    });
    expect(loadTikTokServerConfig({})).toEqual({
      ok: false,
      error: expect.stringContaining("EULER_API_KEY"),
    });
  });

  it("accepts creator input but rejects browser-supplied provider secrets", () => {
    expect(parseTikTokStartRequest({ creator: "@creator" })).toEqual({
      ok: true,
      creator: "@creator",
    });
    expect(parseTikTokStartRequest({ creator: "" }).ok).toBe(false);
    expect(parseTikTokStartRequest({ creator: "@creator", apiKey: "NO" }).ok).toBe(false);
    expect(parseTikTokStartRequest({ creator: "@creator", eulerApiKey: "NO" }).ok).toBe(false);
    expect(parseTikTokStartRequest({ creator: "@creator", token: "NO" }).ok).toBe(false);
  });

  it("makes TikTok stop idempotent without accepting secrets", () => {
    expect(parseTikTokStopRequest({})).toEqual({ ok: true });
    expect(parseTikTokStopRequest(null)).toEqual({ ok: true });
    expect(parseTikTokStopRequest({ apiKey: "NO" }).ok).toBe(false);
    expect(parseTikTokStopRequest([]).ok).toBe(false);
  });

  it("wires TikTok routes and safe browser controls into the existing web runtime", () => {
    const server = readFileSync(resolve(root, "src/server/main.ts"), "utf8");
    const html = readFileSync(resolve(root, "web/index.html"), "utf8");
    const app = readFileSync(resolve(root, "web/app.js"), "utf8");

    expect(server).toContain("TikTokEulerSession");
    expect(server).toContain("TikTokCommentProcessor");
    expect(server).toContain('url.pathname === "/api/tiktok/start"');
    expect(server).toContain('url.pathname === "/api/tiktok/stop"');
    expect(server).toContain('sourceId.startsWith("tiktok-euler:")');

    expect(html).toContain('id="tiktok-input"');
    expect(html).toContain('id="tiktok-start"');
    expect(html).toContain('id="tiktok-stop"');
    expect(html).toContain('id="tiktok-status"');

    expect(app).toContain('postJson("/api/tiktok/start"');
    expect(app).toContain('postJson("/api/tiktok/stop"');
    expect(app).not.toContain(".innerHTML");
    expect(app).not.toContain("EULER_API_KEY");
    expect(app).not.toContain("apiKey");
  });
});
