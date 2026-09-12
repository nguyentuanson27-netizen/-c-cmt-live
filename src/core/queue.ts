import type { Comment } from "./comment";

export class CommentQueue {
  private readonly maxCapacity: number;
  private readonly staleThresholdMs: number;
  private queue: Comment[] = [];

  constructor(maxCapacity = 30, staleThresholdMs = 30_000) {
    this.maxCapacity = maxCapacity;
    this.staleThresholdMs = staleThresholdMs;
  }

  public enqueue(comment: Comment): void {
    if (this.queue.length >= this.maxCapacity) {
      this.queue.shift();
    }
    this.queue.push(comment);
  }

  public dequeue(now = Date.now()): Comment | null {
    while (this.queue.length > 0) {
      const candidate = this.queue.shift()!;
      if (now - candidate.receivedAt <= this.staleThresholdMs) {
        return candidate;
      }
    }
    return null;
  }

  public peek(now = Date.now()): Comment | null {
    while (this.queue.length > 0) {
      const candidate = this.queue[0];
      if (now - candidate.receivedAt <= this.staleThresholdMs) {
        return candidate;
      }
      this.queue.shift();
    }
    return null;
  }

  public size(): number {
    return this.queue.length;
  }

  public removeWhere(predicate: (comment: Comment) => boolean): number {
    const before = this.queue.length;
    this.queue = this.queue.filter((comment) => !predicate(comment));
    return before - this.queue.length;
  }

  public clear(): void {
    this.queue = [];
  }

  public getAll(): readonly Comment[] {
    return this.queue;
  }
}
