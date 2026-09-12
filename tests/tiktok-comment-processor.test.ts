import { describe, expect, it } from "vitest";
import { TikTokCommentProcessor } from "../src/server/tiktok-comment-processor";

const sample = {
  id: "1",
  username: "viewer",
  text: "xin chao",
  timestamp: 1_789_000_000_000,
};

describe("TikTok comment processor", () => {
  it("normalizes comments with stable TikTok source identity", () => {
    const processor = new TikTokCommentProcessor();
    expect(processor.process("Creator_01", sample, 1_789_000_000_100)).toEqual({
      id: "1",
      platform: "tiktok",
      sourceId: "tiktok-euler:Creator_01",
      sourceLabel: "TT-EULER",
      username: "viewer",
      text: "xin chao",
      receivedAt: 1_789_000_000_100,
    });
  });

  it("deduplicates recent same-user/same-text comments and clear resets state", () => {
    const processor = new TikTokCommentProcessor();
    expect(processor.process("alice", sample, 1000)).not.toBeNull();
    expect(processor.process("alice", { ...sample, id: "2" }, 1100)).toBeNull();

    processor.clear();
    expect(processor.process("alice", { ...sample, id: "3" }, 1200)).not.toBeNull();
  });

  it("drops empty provider comments after normalization", () => {
    const processor = new TikTokCommentProcessor();
    expect(processor.process("alice", { ...sample, text: "   " }, 1000)).toBeNull();
  });
});
