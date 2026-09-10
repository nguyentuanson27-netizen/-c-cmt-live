import { describe, expect, it } from "vitest";
import { toRecentCommentView } from "../src/ui/recent-comment";

describe("recent comment view", () => {
  it("preserves usernames containing colons because it uses structured comment fields", () => {
    expect(
      toRecentCommentView({
        platform: "tiktok",
        username: "sà ntin T E L E:phuongnhi74",
        text: "kím chỗ xả ntinTele pé, dcChon",
      }),
    ).toEqual({
      platformLabel: "TIKTOK",
      authorText: "sà ntin T E L E:phuongnhi74: ",
      contentText: "kím chỗ xả ntinTele pé, dcChon",
    });
  });
});
