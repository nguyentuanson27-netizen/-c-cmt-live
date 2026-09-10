import type { Platform } from "../platform";

export type RecentCommentPayload = {
  platform: Platform;
  username: string;
  text: string;
};

export type RecentCommentView = {
  platformLabel: string;
  authorText: string;
  contentText: string;
};

export function toRecentCommentView(comment: RecentCommentPayload): RecentCommentView {
  return {
    platformLabel: comment.platform.toUpperCase(),
    authorText: `${comment.username}: `,
    contentText: comment.text,
  };
}
