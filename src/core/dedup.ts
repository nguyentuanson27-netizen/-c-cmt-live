export type DedupOptions = {
  windowMs?: number;
  maxEntries?: number;
};

export class CommentDedup {
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private readonly seen: Map<string, number> = new Map();

  constructor(options?: DedupOptions) {
    this.windowMs = options?.windowMs ?? 60_000;
    this.maxEntries = options?.maxEntries ?? 1000;
  }

  private makeKey(sourceId: string, username: string, text: string): string {
    return JSON.stringify([
      sourceId.trim(),
      username.toLowerCase().trim(),
      text.toLowerCase().trim(),
    ]);
  }

  private resolveArgs(
    sourceOrUser: string,
    userOrText: string,
    textOrNow?: string | number,
    maybeNow?: number,
  ): { sourceId: string; username: string; text: string; now: number } {
    if (typeof textOrNow === "string") {
      return {
        sourceId: sourceOrUser,
        username: userOrText,
        text: textOrNow,
        now: typeof maybeNow === "number" ? maybeNow : Date.now(),
      };
    }
    return {
      sourceId: "",
      username: sourceOrUser,
      text: userOrText,
      now: typeof textOrNow === "number" ? textOrNow : Date.now(),
    };
  }

  public isDuplicate(sourceId: string, username: string, text: string, now?: number): boolean;
  public isDuplicate(username: string, text: string, now?: number): boolean;
  public isDuplicate(
    sourceOrUser: string,
    userOrText: string,
    textOrNow?: string | number,
    maybeNow?: number,
  ): boolean {
    const { sourceId, username, text, now } = this.resolveArgs(
      sourceOrUser,
      userOrText,
      textOrNow,
      maybeNow,
    );

    const key = this.makeKey(sourceId, username, text);
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

  public record(sourceId: string, username: string, text: string, now?: number): void;
  public record(username: string, text: string, now?: number): void;
  public record(
    sourceOrUser: string,
    userOrText: string,
    textOrNow?: string | number,
    maybeNow?: number,
  ): void {
    const { sourceId, username, text, now } = this.resolveArgs(
      sourceOrUser,
      userOrText,
      textOrNow,
      maybeNow,
    );

    const key = this.makeKey(sourceId, username, text);
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
