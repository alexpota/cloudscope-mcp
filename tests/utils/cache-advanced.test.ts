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
    const cache = new Cache<string>(60, 100);
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('overwrites existing key with new value', () => {
    const cache = new Cache<string>(60, 100);
    cache.set('key', 'first');
    cache.set('key', 'second');
    expect(cache.get('key')).toBe('second');
  });

  it('overwriting resets the TTL', () => {
    const cache = new Cache<string>(60, 100);
    cache.set('key', 'first');
    vi.advanceTimersByTime(50 * 1000);
    cache.set('key', 'refreshed');
    vi.advanceTimersByTime(50 * 1000);
    expect(cache.get('key')).toBe('refreshed');
  });

  it('cache hit returns same reference', () => {
    const cache = new Cache<{ content: string[] }>(60, 100);
    const value = { content: ['hello'] };
    cache.set('key', value);
    expect(cache.get('key')).toBe(value);
  });

  it('different keys are independent', () => {
    const cache = new Cache<string>(60, 100);
    cache.set('a', 'alpha');
    cache.set('b', 'beta');
    expect(cache.get('a')).toBe('alpha');
    expect(cache.get('b')).toBe('beta');
  });

  it('cache with 0 TTL expires immediately', () => {
    const cache = new Cache<string>(0, 100);
    cache.set('key', 'value');
    vi.advanceTimersByTime(1);
    expect(cache.get('key')).toBeUndefined();
  });

  it('reports size correctly', () => {
    const cache = new Cache<string>(60, 100);
    expect(cache.size()).toBe(0);
    cache.set('a', '1');
    cache.set('b', '2');
    expect(cache.size()).toBe(2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('evicts oldest entry when max size reached', () => {
    const cache = new Cache<string>(60, 3);
    cache.set('a', 'first');
    cache.set('b', 'second');
    cache.set('c', 'third');
    expect(cache.size()).toBe(3);

    // Adding a 4th should evict 'a' (oldest)
    cache.set('d', 'fourth');
    expect(cache.size()).toBe(3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('second');
    expect(cache.get('d')).toBe('fourth');
  });

  it('evicts expired entries on set()', () => {
    const cache = new Cache<string>(60, 100);
    cache.set('old', 'stale');
    vi.advanceTimersByTime(61 * 1000);
    // 'old' is now expired; setting a new key should clean it up
    cache.set('new', 'fresh');
    expect(cache.size()).toBe(1);
    expect(cache.get('old')).toBeUndefined();
    expect(cache.get('new')).toBe('fresh');
  });

  it('does not evict when overwriting existing key at max capacity', () => {
    const cache = new Cache<string>(60, 2);
    cache.set('a', 'v1');
    cache.set('b', 'v2');
    // Overwriting 'a' should NOT evict 'b'
    cache.set('a', 'v3');
    expect(cache.size()).toBe(2);
    expect(cache.get('a')).toBe('v3');
    expect(cache.get('b')).toBe('v2');
  });
});
