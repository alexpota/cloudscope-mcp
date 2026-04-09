import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Cache } from '../../src/utils/cache.js';

describe('Cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns cached value before TTL expires', () => {
    const cache = new Cache<string>(60, 100);
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('returns undefined after TTL expires', () => {
    const cache = new Cache<string>(60, 100);
    cache.set('key1', 'value1');
    vi.advanceTimersByTime(61 * 1000);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('clears all entries', () => {
    const cache = new Cache<string>(60, 100);
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBeUndefined();
  });
});

describe('Cache.getOrFetch', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('calls fetcher on cache miss and caches the result', async () => {
    const cache = new Cache<string>(60, 100);
    const fetcher = vi.fn().mockResolvedValue('value1');

    const result = await cache.getOrFetch('key1', fetcher);

    expect(result).toBe('value1');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.get('key1')).toBe('value1');
  });

  it('returns cached value on second call without invoking fetcher', async () => {
    const cache = new Cache<string>(60, 100);
    const fetcher = vi.fn().mockResolvedValue('value1');

    await cache.getOrFetch('key1', fetcher);
    const result = await cache.getOrFetch('key1', fetcher);

    expect(result).toBe('value1');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent calls for the same key into a single fetch', async () => {
    const cache = new Cache<string>(60, 100);
    let resolveFetch: (value: string) => void = () => {};
    const fetcher = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    // Fire three concurrent calls before the fetch resolves
    const promise1 = cache.getOrFetch('key1', fetcher);
    const promise2 = cache.getOrFetch('key1', fetcher);
    const promise3 = cache.getOrFetch('key1', fetcher);

    // The fetcher should have been invoked exactly once — the other two
    // callers share the in-flight promise.
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetch('value1');

    const results = await Promise.all([promise1, promise2, promise3]);
    expect(results).toEqual(['value1', 'value1', 'value1']);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not cache a fetcher error and allows the next call to retry', async () => {
    const cache = new Cache<string>(60, 100);
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('value1');

    await expect(cache.getOrFetch('key1', fetcher)).rejects.toThrow('transient');

    // Cache must not contain the failed result
    expect(cache.get('key1')).toBeUndefined();

    // Next call should invoke fetcher again, succeed, and cache
    const result = await cache.getOrFetch('key1', fetcher);
    expect(result).toBe('value1');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('cleans up in-flight tracking when a concurrent fetch rejects', async () => {
    const cache = new Cache<string>(60, 100);
    let rejectFetch: (err: Error) => void = () => {};
    const firstFetcher = vi.fn(
      () =>
        new Promise<string>((_, reject) => {
          rejectFetch = reject;
        }),
    );

    const promise1 = cache.getOrFetch('key1', firstFetcher);
    const promise2 = cache.getOrFetch('key1', firstFetcher);

    rejectFetch(new Error('boom'));

    await expect(promise1).rejects.toThrow('boom');
    await expect(promise2).rejects.toThrow('boom');

    // After the rejection, a subsequent call must NOT see the old in-flight
    // entry — a new fetch starts cleanly.
    const secondFetcher = vi.fn().mockResolvedValue('recovered');
    const result = await cache.getOrFetch('key1', secondFetcher);

    expect(result).toBe('recovered');
    expect(secondFetcher).toHaveBeenCalledTimes(1);
  });

  it('treats different keys as independent entries', async () => {
    const cache = new Cache<string>(60, 100);
    const fetcherA = vi.fn().mockResolvedValue('a');
    const fetcherB = vi.fn().mockResolvedValue('b');

    const [a, b] = await Promise.all([
      cache.getOrFetch('keyA', fetcherA),
      cache.getOrFetch('keyB', fetcherB),
    ]);

    expect(a).toBe('a');
    expect(b).toBe('b');
    expect(fetcherA).toHaveBeenCalledTimes(1);
    expect(fetcherB).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after TTL expires', async () => {
    vi.useFakeTimers();
    const cache = new Cache<string>(60, 100);
    const fetcher = vi.fn().mockResolvedValueOnce('value1').mockResolvedValueOnce('value2');

    const first = await cache.getOrFetch('key1', fetcher);
    expect(first).toBe('value1');

    vi.advanceTimersByTime(61 * 1000);

    const second = await cache.getOrFetch('key1', fetcher);
    expect(second).toBe('value2');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
