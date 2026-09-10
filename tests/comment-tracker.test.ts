import { describe, expect, it } from "vitest";
import { createCommentTracker } from "../src/connectors/comment-tracker";

type FixtureComment = {
  username: string;
  text: string;
};

describe("connector comment tracker", () => {
  it("baselines comments already present at startup without emitting them as new", () => {
    const historical: FixtureComment = { username: "Alice", text: "old comment" };
    const newComment: FixtureComment = { username: "Bob", text: "new comment" };
    const takeNewComment = createCommentTracker<FixtureComment, FixtureComment>(
      (comment) => comment,
      [historical],
    );

    expect(takeNewComment(historical)).toBeNull();
    expect(takeNewComment(newComment)).toEqual(newComment);
    expect(takeNewComment(newComment)).toBeNull();
  });
});
