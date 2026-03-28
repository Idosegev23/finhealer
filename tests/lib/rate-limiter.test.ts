/**
 * Rate Limiter Tests
 */

import { describe, it, expect } from 'vitest';

// Extract logic for testing (avoid importing singleton)
class TestLimiter {
  private running = 0;
  private queue: Array<{ resolve: (v: any) => void; reject: (e: any) => void; fn: () => Promise<any> }> = [];

  constructor(private maxConcurrent: number, private maxQueueSize: number = 50) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running < this.maxConcurrent) return this.run(fn);
    if (this.queue.length >= this.maxQueueSize) throw new Error('Rate limiter queue full');
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ resolve, reject, fn });
    });
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    this.running++;
    try { return await fn(); }
    finally { this.running--; this.processQueue(); }
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.running < this.maxConcurrent) {
      const next = this.queue.shift()!;
      this.run(next.fn).then(next.resolve).catch(next.reject);
    }
  }

  get stats() { return { running: this.running, queued: this.queue.length }; }
}

describe('Rate Limiter: Concurrency', () => {
  it('allows up to maxConcurrent parallel calls', async () => {
    const limiter = new TestLimiter(3);
    let maxSeen = 0;
    let current = 0;

    const task = () => new Promise<void>(resolve => {
      current++;
      maxSeen = Math.max(maxSeen, current);
      setTimeout(() => { current--; resolve(); }, 10);
    });

    await Promise.all([
      limiter.execute(task),
      limiter.execute(task),
      limiter.execute(task),
    ]);

    expect(maxSeen).toBeLessThanOrEqual(3);
  });

  it('queues tasks beyond maxConcurrent', async () => {
    const limiter = new TestLimiter(2);
    const order: number[] = [];

    const task = (id: number) => new Promise<void>(resolve => {
      setTimeout(() => { order.push(id); resolve(); }, 10);
    });

    await Promise.all([
      limiter.execute(() => task(1)),
      limiter.execute(() => task(2)),
      limiter.execute(() => task(3)),
      limiter.execute(() => task(4)),
    ]);

    expect(order).toHaveLength(4);
    // All should complete
  });

  it('rejects when queue is full', async () => {
    const limiter = new TestLimiter(1, 2);

    // Fill concurrency + queue
    const slow = () => new Promise(r => setTimeout(r, 100));
    limiter.execute(slow); // running
    limiter.execute(slow); // queued 1
    limiter.execute(slow); // queued 2

    // This should throw
    await expect(limiter.execute(slow)).rejects.toThrow('queue full');
  });

  it('passes through errors from tasks', async () => {
    const limiter = new TestLimiter(5);
    const failing = () => Promise.reject(new Error('API down'));

    await expect(limiter.execute(failing)).rejects.toThrow('API down');
  });

  it('continues processing after error', async () => {
    const limiter = new TestLimiter(1);

    try {
      await limiter.execute(() => Promise.reject(new Error('fail')));
    } catch {}

    // Should still work after error
    const result = await limiter.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });
});
