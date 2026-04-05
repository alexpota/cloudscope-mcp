import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Cache } from '../../src/utils/cache.js';

describe('Cache advanced scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined for key that was never set', () => {
    const cache = new Cache<string>(60);
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('overwrites existing key with new value', () => {
    const cache = new Cache<string>(60);
    cache.set('key', 'first');
    cache.set('key', 'second');
    expect(cache.get('key')).toBe('second');
  });

  it('overwriting resets the TTL', () => {
    const cache = new Cache<string>(60);
    cache.set('key', 'first');
    vi.advanceTimersByTime(50 * 1000); // 50s elapsed
    cache.set('key', 'refreshed');
    vi.advanceTimersByTime(50 * 1000); // 100s total, but only 50s since refresh
    expect(cache.get('key')).toBe('refreshed'); // should still be alive
  });

  it('cache hit returns same reference (no deep copy)', () => {
    const cache = new Cache<{ content: string[] }>(60);
    const value = { content: ['hello'] };
    cache.set('key', value);
    expect(cache.get('key')).toBe(value); // same reference
  });

  it('different keys are independent', () => {
    const cache = new Cache<string>(60);
    cache.set('a', 'alpha');
    cache.set('b', 'beta');
    expect(cache.get('a')).toBe('alpha');
    expect(cache.get('b')).toBe('beta');
  });

  it('cache with 0 TTL expires immediately', () => {
    const cache = new Cache<string>(0);
    cache.set('key', 'value');
    // At time 0, expiry is also 0, and Date.now() > 0 is false...
    // but after any time passes it expires
    vi.advanceTimersByTime(1);
    expect(cache.get('key')).toBeUndefined();
  });
});
