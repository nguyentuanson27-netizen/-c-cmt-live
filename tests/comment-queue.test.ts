import { describe, expect, it } from 'vitest';
import { CommentQueue } from '../src/core/queue';
import type { Comment } from '../src/core/comment';

function makeComment(id: string, text: string, receivedAt: number, sourceId = 'src_1'): Comment {
  return {
    id,
    platform: 'facebook',
    sourceId,
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

    queue.enqueue(makeComment('31', 'comment 31', now));
    expect(queue.size()).toBe(30);
    expect(queue.dequeue(now)?.id).toBe('2');
  });

  it('skips stale comments older than 30 seconds when dequeuing', () => {
    const queue = new CommentQueue();
    const t0 = 100000;

    queue.enqueue(makeComment('1', 'stale comment', t0));
    queue.enqueue(makeComment('2', 'fresh comment', t0 + 20000));

    const item = queue.dequeue(t0 + 35000);
    expect(item).not.toBeNull();
    expect(item?.id).toBe('2');
  });

  it('removes only queued items matching a predicate while preserving FIFO order', () => {
    const queue = new CommentQueue();
    const now = 100000;
    queue.enqueue(makeComment('a1', 'A one', now, 'facebook-graph:111'));
    queue.enqueue(makeComment('b1', 'B one', now, 'facebook-graph:222'));
    queue.enqueue(makeComment('a2', 'A two', now, 'facebook-graph:111'));
    queue.enqueue(makeComment('b2', 'B two', now, 'facebook-graph:222'));

    expect(queue.removeWhere((comment) => comment.sourceId === 'facebook-graph:111')).toBe(2);
    expect(queue.getAll().map((comment) => comment.id)).toEqual(['b1', 'b2']);
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
