/**
 * Simple concurrency-based rate limiter for Gemini API calls.
 * Prevents overwhelming the API with too many concurrent requests.
 *
 * Usage:
 *   const result = await geminiLimiter.execute(() => chatWithGeminiFlash(...));
 */

class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<{ resolve: (value: any) => void; reject: (err: any) => void; fn: () => Promise<any> }> = [];

  constructor(
    private maxConcurrent: number = 5,
    private maxQueueSize: number = 50
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running < this.maxConcurrent) {
      return this.run(fn);
    }

    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Rate limiter queue full — too many concurrent requests');
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({ resolve, reject, fn });
    });
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    this.running++;
    try {
      const result = await fn();
      return result;
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.running < this.maxConcurrent) {
      const next = this.queue.shift()!;
      this.run(next.fn).then(next.resolve).catch(next.reject);
    }
  }

  get stats() {
    return { running: this.running, queued: this.queue.length };
  }
}

// Singleton: max 5 concurrent Gemini calls
export const geminiLimiter = new ConcurrencyLimiter(5, 50);
