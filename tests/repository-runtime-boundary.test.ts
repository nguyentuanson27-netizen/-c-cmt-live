import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(root, path), "utf8")) as Record<string, unknown>;
}

describe("repository runtime boundary", () => {
  it("has no Electron dependency, bootstrap step, or lockfile package", () => {
    const pkg = readJson("package.json");
    const lock = readJson("package-lock.json");
    const devDependencies = (pkg.devDependencies ?? {}) as Record<string, unknown>;
    const scripts = (pkg.scripts ?? {}) as Record<string, unknown>;
    const lockPackages = (lock.packages ?? {}) as Record<string, unknown>;
    const lockRoot = (lockPackages[""] ?? {}) as Record<string, unknown>;
    const lockDevDependencies = (lockRoot.devDependencies ?? {}) as Record<string, unknown>;
    const electronLockEntries = Object.keys(lockPackages).filter(
      (path) => path === "node_modules/electron" || path.includes("@electron"),
    );

    expect(devDependencies).not.toHaveProperty("electron");
    expect(lockDevDependencies).not.toHaveProperty("electron");
    expect(electronLockEntries).toEqual([]);
    expect(scripts).not.toHaveProperty("pretest");
    expect(scripts).not.toHaveProperty("check:runtime-modules");
    expect(String(scripts.build ?? "")).not.toContain("check:runtime-modules");
  });

  it("keeps only the active web runtime, not the legacy Electron harness", () => {
    const legacyPaths = [
      "src/main.ts",
      "src/connectors/facebook/preload.ts",
      "src/connectors/tiktok/preload.ts",
      "src/connectors/shopee/preload.ts",
      "src/security/ipc.ts",
      "src/security/platform-url.ts",
      "src/ui/preload.ts",
      "src/ui/renderer.ts",
      "src/windows/source-window.ts",
      "public/index.html",
      "public/app.css",
      "public/bootstrap.js",
      "scripts/check-runtime-modules.cjs",
      "tests/facebook-parser.test.ts",
      "tests/tiktok-parser.test.ts",
      "tests/ipc-security.test.ts",
      "tests/platform-url.test.ts",
      "tests/preload-element-tracking.test.ts",
      "tests/source-window.test.ts",
      "docs/runbooks/feasibility-harness.md",
      "docs/specs/live-comment-tts-mvp.md",
    ];

    for (const path of legacyPaths) {
      expect(existsSync(resolve(root, path)), `legacy path should be removed: ${path}`).toBe(false);
    }

    expect(existsSync(resolve(root, "src/platform.ts"))).toBe(true);
    expect(existsSync(resolve(root, "src/server/main.ts"))).toBe(true);
    expect(existsSync(resolve(root, "web/index.html"))).toBe(true);
    expect(existsSync(resolve(root, "web/app.js"))).toBe(true);
  });
});
