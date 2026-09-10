import { describe, expect, it } from "vitest";
import { createFacebookProcessedArticleSet } from "../src/connectors/facebook/preload";
import { createTikTokProcessedElementSet } from "../src/connectors/tiktok/preload";

function fakeElement(): Element {
  return {} as Element;
}

describe("sandboxed preload element tracking", () => {
  it("baselines existing Facebook DOM elements but allows distinct new elements", () => {
    const historical = fakeElement();
    const repeatedContentInNewElement = fakeElement();
    const processed = createFacebookProcessedArticleSet([historical]);

    expect(processed.has(historical)).toBe(true);
    expect(processed.has(repeatedContentInNewElement)).toBe(false);

    processed.add(repeatedContentInNewElement);
    expect(processed.has(repeatedContentInNewElement)).toBe(true);
  });

  it("baselines existing TikTok DOM elements by identity rather than comment text", () => {
    const historical = fakeElement();
    const sameTextLater = fakeElement();
    const processed = createTikTokProcessedElementSet([historical]);

    expect(processed.has(historical)).toBe(true);
    expect(processed.has(sameTextLater)).toBe(false);
  });
});
