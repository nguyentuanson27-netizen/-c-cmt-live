import { CommentDedup } from "../core/dedup";
import { normalizeComment } from "../core/filter";
import type { Comment } from "../core/comment";
import type { FacebookGraphComment } from "./facebook-graph";

const FACEBOOK_UNKNOWN_VIEWER = "facebook viewer";

export class FacebookCommentProcessor {
  private readonly dedupByLive = new Map<string, CommentDedup>();

  public process(
    liveVideoId: string,
    graphComment: FacebookGraphComment,
    receivedAt = Date.now(),
  ): Comment | null {
    const normalized = normalizeComment(graphComment.username, graphComment.text);
    if (!normalized) {
      return null;
    }

    const hasReliableViewerIdentity =
      normalized.username.toLowerCase().trim() !== FACEBOOK_UNKNOWN_VIEWER;

    if (hasReliableViewerIdentity) {
      let dedup = this.dedupByLive.get(liveVideoId);
      if (!dedup) {
        dedup = new CommentDedup({ windowMs: 60_000, maxEntries: 2000 });
        this.dedupByLive.set(liveVideoId, dedup);
      }
      if (dedup.isDuplicate(normalized.username, normalized.text, receivedAt)) {
        return null;
      }
      dedup.record(normalized.username, normalized.text, receivedAt);
    }

    return {
      id: graphComment.id,
      platform: "facebook",
      sourceId: `facebook-graph:${liveVideoId}`,
      sourceLabel: "FB-API",
      username: normalized.username,
      text: normalized.text,
      receivedAt,
    };
  }

  public clearLive(liveVideoId: string): void {
    this.dedupByLive.delete(liveVideoId);
  }

  public clearAll(): void {
    this.dedupByLive.clear();
  }
}
