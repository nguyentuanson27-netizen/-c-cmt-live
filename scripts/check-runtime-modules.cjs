const fs = require("node:fs");

const policies = [
  { file: "dist/ui/renderer.js", allowedRequires: [] },
  { file: "dist/ui/preload.js", allowedRequires: ["electron"] },
  { file: "dist/connectors/facebook/preload.js", allowedRequires: ["electron"] },
  { file: "dist/connectors/tiktok/preload.js", allowedRequires: ["electron"] },
  { file: "dist/connectors/shopee/preload.js", allowedRequires: ["electron"] },
];

for (const { file, allowedRequires } of policies) {
  const source = fs.readFileSync(file, "utf8");
  const requiredModules = Array.from(
    source.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g),
    (match) => match[1],
  );

  const unsupported = requiredModules.filter((moduleName) => !allowedRequires.includes(moduleName));
  if (unsupported.length > 0) {
    throw new Error(
      `${file} contains unsupported runtime require(s): ${unsupported.join(", ")}. ` +
        "Renderer code and sandboxed preloads must stay self-contained unless the build adds a bundler.",
    );
  }
}

console.log("Runtime module boundary check passed.");
