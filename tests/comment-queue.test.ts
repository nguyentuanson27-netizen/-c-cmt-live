import { describe, expect, it } from 'vitest';
import { CommentQueue } from '../src/core/queue';
import type { Comment } from '../src/core/comment';

function makeComment(id: string, text: string, receivedAt: number): Comment {
  return {
    id,
    platform: 'facebook',
    sourceId: 'src_1',
    username: 'User_' + id,
    text,
    receivedAt,
  };
}

describe('bounded FIFO comment queue', () => {
  it('enqueues and dequeues in FIFO order', () => {
    const queue = new CommentQueue();
    const now = 100000;

    queue.enqueue(makeComment('1', 'comment 1', now));
    queue.enqueue(makeComment('2', 'comment 2', now));

    expect(queue.size()).toBe(2);
    expect(queue.dequeue(now)?.id).toBe('1');
    expect(queue.dequeue(now)?.id).toBe('2');
    expect(queue.size()).toBe(0);
    expect(queue.dequeue(now)).toBeNull();
  });

  it('drops oldest comment when queue exceeds max capacity of 30', () => {
    const queue = new CommentQueue(30);
    const now = 100000;

    for (let i = 1; i <= 30; i++) {
      queue.enqueue(makeComment(String(i), 'comment ' + i, now));
    }
    expect(queue.size()).toBe(30);

    // Enqueue 31st item -> item 1 should be dropped
    queue.enqueue(makeComment('31', 'comment 31', now));
    expect(queue.size()).toBe(30);

    // First dequeued item should now be 2
    expect(queue.dequeue(now)?.id).toBe('2');
  });

  it('skips stale comments older than 30 seconds when dequeuing', () => {
    const queue = new CommentQueue();
    const t0 = 100000;

    // Comment 1 received at t0
    queue.enqueue(makeComment('1', 'stale comment', t0));
    // Comment 2 received at t0 + 20s
    queue.enqueue(makeComment('2', 'fresh comment', t0 + 20000));

    // Dequeue at t0 + 35s:
    // Comment 1 age = 35s > 30s -> skipped
    // Comment 2 age = 15s <= 30s -> dequeued
    const item = queue.dequeue(t0 + 35000);
    expect(item).not.toBeNull();
    expect(item?.id).toBe('2');
  });

  it('clears all items on clear()', () => {
    const queue = new CommentQueue();
    queue.enqueue(makeComment('1', 'c1', 1000));
    queue.enqueue(makeComment('2', 'c2', 1000));
    expect(queue.size()).toBe(2);

    queue.clear();
    expect(queue.size()).toBe(0);
    expect(queue.dequeue(1000)).toBeNull();
  });
});
