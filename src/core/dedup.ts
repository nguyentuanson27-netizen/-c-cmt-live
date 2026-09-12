export type DedupOptions = {
  windowMs?: number;
  maxEntries?: number;
};

const FACEBOOK_UNKNOWN_VIEWER = "facebook viewer";

export class CommentDedup {
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private readonly seen: Map<string, number> = new Map();

  constructor(options?: DedupOptions) {
    this.windowMs = options?.windowMs ?? 60_000;
    this.maxEntries = options?.maxEntries ?? 1000;
  }

  private isUnattributedFacebookViewer(username: string): boolean {
    return username.toLowerCase().trim() === FACEBOOK_UNKNOWN_VIEWER;
  }

  private makeKey(username: string, text: string): string {
    return JSON.stringify([
      username.toLowerCase().trim(),
      text.toLowerCase().trim(),
    ]);
  }

  public isDuplicate(username: string, text: string, now = Date.now()): boolean {
    // Meta may omit commenter identity for Graph API Page comments. In that case all
    // viewers share the same fallback label, so content-based dedup would drop valid
    // comments from different people. The Graph poller already advances by comment ID.
    if (this.isUnattributedFacebookViewer(username)) {
      return false;
    }

    const key = this.makeKey(username, text);
    const lastSeen = this.seen.get(key);
    if (lastSeen === undefined) {
      return false;
    }
    if (now - lastSeen > this.windowMs) {
      this.seen.delete(key);
      return false;
    }
    return true;
  }

  public record(username: string, text: string, now = Date.now()): void {
    if (this.isUnattributedFacebookViewer(username)) {
      return;
    }

    const key = this.makeKey(username, text);
    if (this.seen.size >= this.maxEntries) {
      const firstKey = this.seen.keys().next().value;
      if (firstKey) {
        this.seen.delete(firstKey);
      }
    }
    this.seen.set(key, now);
  }

  public clear(): void {
    this.seen.clear();
  }
}