import { describe, expect, it } from "vitest";
import { FacebookCommentProcessor } from "../src/server/facebook-comment-processor";
import type { FacebookGraphComment } from "../src/server/facebook-graph";

function graphComment(id: string, username: string, text: string): FacebookGraphComment {
  return {
    id,
    username,
    text,
    createdTime: "2026-09-12T06:00:00Z",
    timestamp: Date.parse("2026-09-12T06:00:00Z"),
  };
}

describe("FacebookCommentProcessor", () => {
  it("scopes content deduplication by live video ID", () => {
    const processor = new FacebookCommentProcessor();
    const first = processor.process("111", graphComment("a", "Alice", "chốt"), 1000);
    const duplicateSameLive = processor.process("111", graphComment("b", "Alice", "chốt"), 1500);
    const sameContentOtherLive = processor.process("222", graphComment("c", "Alice", "chốt"), 1500);

    expect(first?.sourceId).toBe("facebook-graph:111");
    expect(duplicateSameLive).toBeNull();
    expect(sameContentOtherLive?.sourceId).toBe("facebook-graph:222");
  });

  it("does not content-deduplicate unattributed Facebook viewers", () => {
    const processor = new FacebookCommentProcessor();

    expect(processor.process("111", graphComment("a", "Facebook viewer", "chốt"), 1000)).not.toBeNull();
    expect(processor.process("111", graphComment("b", "Facebook viewer", "chốt"), 1500)).not.toBeNull();
  });

  it("clears dedup state for only the requested live", () => {
    const processor = new FacebookCommentProcessor();
    processor.process("111", graphComment("a", "Alice", "chốt"), 1000);
    processor.process("222", graphComment("b", "Alice", "chốt"), 1000);

    processor.clearLive("111");

    expect(processor.process("111", graphComment("c", "Alice", "chốt"), 1500)).not.toBeNull();
    expect(processor.process("222", graphComment("d", "Alice", "chốt"), 1500)).toBeNull();
  });
});
