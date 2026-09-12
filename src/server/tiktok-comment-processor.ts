import type { Comment } from "../core/comment";
import { CommentDedup } from "../core/dedup";
import { normalizeComment } from "../core/filter";
import type { TikTokEulerComment } from "./tiktok-euler";

export class TikTokCommentProcessor {
  private readonly dedup = new CommentDedup({ windowMs: 60_000, maxEntries: 2000 });

  public process(
    creator: string,
    providerComment: TikTokEulerComment,
    receivedAt = Date.now(),
  ): Comment | null {
    const normalized = normalizeComment(providerComment.username, providerComment.text);
    if (!normalized) {
      return null;
    }

    if (this.dedup.isDuplicate(normalized.username, normalized.text, receivedAt)) {
      return null;
    }
    this.dedup.record(normalized.username, normalized.text, receivedAt);

    return {
      id: providerComment.id,
      platform: "tiktok",
      sourceId: `tiktok-euler:${creator}`,
      sourceLabel: "TT-EULER",
      username: normalized.username,
      text: normalized.text,
      receivedAt,
    };
  }

  public clear(): void {
    this.dedup.clear();
  }
}
