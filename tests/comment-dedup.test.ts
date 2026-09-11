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

  it('identifies identical comment from same source and user within window as duplicate', () => {
    const dedup = new CommentDedup({ windowMs: 10000 });
    const now = 100000;

    expect(dedup.isDuplicate('source-1', 'Alice', 'áo size M còn không', now)).toBe(false);
    dedup.record('source-1', 'Alice', 'áo size M còn không', now);

    expect(dedup.isDuplicate('source-1', 'Alice', 'áo size M còn không', now + 1000)).toBe(true);
    expect(dedup.isDuplicate('source-1', 'alice', 'ÁO SIZE M CÒN KHÔNG', now + 2000)).toBe(true);

    // Different comment text from same user on same source must NOT be duplicate
    expect(dedup.isDuplicate('source-1', 'Alice', 'chốt size L nhé', now + 3000)).toBe(false);
  });

  it('allows identical comment from same user on different sources within window', () => {
    const dedup = new CommentDedup({ windowMs: 10000 });
    const now = 100000;

    dedup.record('source-1', 'Alice', 'áo size M còn không', now);

    // Same username + text from a different source must NOT be dropped as duplicate
    expect(dedup.isDuplicate('source-2', 'Alice', 'áo size M còn không', now + 1000)).toBe(false);

    // But same source still is duplicate
    expect(dedup.isDuplicate('source-1', 'Alice', 'áo size M còn không', now + 1000)).toBe(true);
  });

  it('does not collide when sourceId contains colons or special characters', () => {
    const dedup = new CommentDedup();
    const now = 100000;

    dedup.record('source:1', 'Alice', 'text', now);

    expect(dedup.isDuplicate('source', '1:Alice', 'text', now + 1000)).toBe(false);
    expect(dedup.isDuplicate('source:1', 'Alice', 'text', now + 1000)).toBe(true);
  });
});

