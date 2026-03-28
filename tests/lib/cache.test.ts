import { describe, it, expect, beforeEach } from 'vitest';
import { cache } from '../../lib/utils/cache';

describe('MemoryCache', () => {
  beforeEach(() => {
    cache.clear();
  });

  it('stores and retrieves values', () => {
    cache.set('key1', 'value1', 60);
    expect(cache.get('key1')).toBe('value1');
  });

  it('returns null for missing keys', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('expires after TTL', async () => {
    cache.set('key1', 'value1', 0.1); // 100ms TTL
    await new Promise(r => setTimeout(r, 150));
    expect(cache.get('key1')).toBeNull();
  });

  it('getOrSet returns cached value on hit', async () => {
    let callCount = 0;
    const factory = async () => { callCount++; return 'expensive'; };

    const v1 = await cache.getOrSet('key', 60, factory);
    const v2 = await cache.getOrSet('key', 60, factory);

    expect(v1).toBe('expensive');
    expect(v2).toBe('expensive');
    expect(callCount).toBe(1); // factory called only once
  });

  it('invalidate removes matching keys', () => {
    cache.set('user:123:flow', 'a', 60);
    cache.set('user:123:ctx', 'b', 60);
    cache.set('user:456:flow', 'c', 60);

    cache.invalidate('123');

    expect(cache.get('user:123:flow')).toBeNull();
    expect(cache.get('user:123:ctx')).toBeNull();
    expect(cache.get('user:456:flow')).toBe('c');
  });
});
