import { describe, expect, it } from 'vitest';
import { CommentDedup } from '../src/core/dedup';

describe('comment deduplication', () => {
  it('identifies identical comment from same user within window as duplicate', () => {
    const dedup = new CommentDedup({ windowMs: 10000 });
    const now = 100000;

    expect(dedup.isDuplicate('Alice', 'áo size M còn không', now)).toBe(false);
    dedup.record('Alice', 'áo size M còn không', now);

    expect(dedup.isDuplicate('Alice', 'áo size M còn không', now + 1000)).toBe(true);
    expect(dedup.isDuplicate('alice', 'ÁO SIZE M CÒN KHÔNG', now + 2000)).toBe(true);
  });

  it('allows same comment from different users', () => {
    const dedup = new CommentDedup();
    const now = 100000;

    dedup.record('Alice', 'giá bao nhiêu', now);
    expect(dedup.isDuplicate('Bob', 'giá bao nhiêu', now)).toBe(false);
  });

  it('allows same user to send different comments', () => {
    const dedup = new CommentDedup();
    const now = 100000;

    dedup.record('Alice', 'giá bao nhiêu', now);
    expect(dedup.isDuplicate('Alice', 'chốt size L nhé', now)).toBe(false);
  });

  it('expires duplicates after windowMs elapses', () => {
    const dedup = new CommentDedup({ windowMs: 5000 });
    const now = 100000;

    dedup.record('Alice', 'chào shop', now);
    expect(dedup.isDuplicate('Alice', 'chào shop', now + 2000)).toBe(true);
    expect(dedup.isDuplicate('Alice', 'chào shop', now + 6000)).toBe(false);
  });

  it('does not collide when usernames or comment text contain colons', () => {
    const dedup = new CommentDedup();
    const now = 100000;

    dedup.record('a:b', 'c', now);

    expect(dedup.isDuplicate('a', 'b:c', now + 1000)).toBe(false);
    expect(dedup.isDuplicate('a:b', 'c', now + 1000)).toBe(true);
  });
});
