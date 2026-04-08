import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  applyJitter,
  computeBackoffDelay,
  createRateLimiter,
  withRetry,
} from '../../src/utils/rate-limit.js';

describe('createRateLimiter', () => {
  it('runs a single operation without queueing when below the limit', async () => {
    const limiter = createRateLimiter({ concurrency: 2 });
    const result = await limiter.run(async () => 'done');
    expect(result).toBe('done');
  });

  it('runs up to `concurrency` operations in parallel', async () => {
    const limiter = createRateLimiter({ concurrency: 2 });
    let inFlight = 0;
    let peak = 0;

    const op = async (): Promise<void> => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight--;
    };

    await Promise.all([limiter.run(op), limiter.run(op), limiter.run(op), limiter.run(op)]);

    expect(peak).toBe(2);
  });

  it('releases a slot when an operation throws', async () => {
    const limiter = createRateLimiter({ concurrency: 1 });

    await expect(
      limiter.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // A subsequent call must succeed (slot was released despite the throw)
    const result = await limiter.run(async () => 'ok');
    expect(result).toBe('ok');
  });

  it('queues operations beyond the concurrency limit in FIFO order', async () => {
    const limiter = createRateLimiter({ concurrency: 1 });
    const order: number[] = [];

    const makeOp = (id: number, durationMs: number) => async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, durationMs));
      order.push(id);
    };

    await Promise.all([
      limiter.run(makeOp(1, 30)),
      limiter.run(makeOp(2, 10)),
      limiter.run(makeOp(3, 10)),
    ]);

    expect(order).toEqual([1, 2, 3]);
  });

  it('throws when concurrency is less than 1', () => {
    expect(() => createRateLimiter({ concurrency: 0 })).toThrow();
    expect(() => createRateLimiter({ concurrency: -1 })).toThrow();
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the result on first success without retrying', async () => {
    const fn = vi.fn(async () => 'ok');
    const result = await withRetry(fn, { isRetryable: () => true });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries retryable errors up to maxAttempts and eventually succeeds', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error('throttled');
      return 'ok';
    });

    const promise = withRetry(fn, {
      isRetryable: (err) => (err as Error).message === 'throttled',
      baseDelayMs: 1000,
      maxDelayMs: 4000,
      jitterFactor: 0,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn(async () => {
      throw new Error('fatal');
    });

    await expect(
      withRetry(fn, { isRetryable: (err) => (err as Error).message === 'throttled' }),
    ).rejects.toThrow('fatal');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rethrows the last error after maxAttempts retries', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      throw new Error(`attempt ${calls}`);
    });

    const promise = withRetry(fn, {
      isRetryable: () => true,
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 4000,
      jitterFactor: 0,
    });
    promise.catch(() => {}); // prevent unhandled-rejection warning

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).rejects.toThrow('attempt 3');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('honors extractRetryAfterMs when present, overriding exponential backoff', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new Error('throttled');
      return 'ok';
    });

    const promise = withRetry(fn, {
      isRetryable: () => true,
      extractRetryAfterMs: () => 500,
      baseDelayMs: 5000, // exponential would otherwise dominate
      maxDelayMs: 10000,
      jitterFactor: 0,
    });

    await vi.advanceTimersByTimeAsync(500);

    expect(await promise).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('caps a server-provided Retry-After at maxDelayMs', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new Error('throttled');
      return 'ok';
    });

    const promise = withRetry(fn, {
      isRetryable: () => true,
      extractRetryAfterMs: () => 60_000, // pathological hint — must be capped
      maxDelayMs: 2000,
      jitterFactor: 0,
    });

    await vi.advanceTimersByTimeAsync(2000);

    expect(await promise).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('executes every attempt through a capped backoff cycle', async () => {
    // Delays: 1000ms, 2000ms, 2000ms (the third is 4000ms capped to 2000ms).
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 4) throw new Error('throttled');
      return 'ok';
    });

    const promise = withRetry(fn, {
      isRetryable: () => true,
      maxAttempts: 4,
      baseDelayMs: 1000,
      maxDelayMs: 2000,
      jitterFactor: 0,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);

    expect(await promise).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

describe('computeBackoffDelay', () => {
  it('doubles the delay on each attempt within the cap', () => {
    expect(computeBackoffDelay({ attempt: 0, baseDelayMs: 1000, maxDelayMs: 60000 })).toBe(1000);
    expect(computeBackoffDelay({ attempt: 1, baseDelayMs: 1000, maxDelayMs: 60000 })).toBe(2000);
    expect(computeBackoffDelay({ attempt: 2, baseDelayMs: 1000, maxDelayMs: 60000 })).toBe(4000);
    expect(computeBackoffDelay({ attempt: 3, baseDelayMs: 1000, maxDelayMs: 60000 })).toBe(8000);
  });

  it('caps the delay at maxDelayMs once exponential growth exceeds it', () => {
    expect(computeBackoffDelay({ attempt: 2, baseDelayMs: 1000, maxDelayMs: 2000 })).toBe(2000);
    expect(computeBackoffDelay({ attempt: 3, baseDelayMs: 1000, maxDelayMs: 2000 })).toBe(2000);
    expect(computeBackoffDelay({ attempt: 10, baseDelayMs: 1000, maxDelayMs: 2000 })).toBe(2000);
  });

  it('honors a maxDelayMs smaller than the base delay', () => {
    expect(computeBackoffDelay({ attempt: 0, baseDelayMs: 1000, maxDelayMs: 500 })).toBe(500);
  });
});

describe('applyJitter', () => {
  it('returns the input unchanged when jitterFactor is 0', () => {
    expect(applyJitter(1000, 0)).toBe(1000);
    expect(applyJitter(2000, 0)).toBe(2000);
  });

  it('produces the maximum positive offset when rng returns 1', () => {
    expect(applyJitter(1000, 0.25, () => 1)).toBe(1250);
  });

  it('produces the maximum negative offset when rng returns 0', () => {
    expect(applyJitter(1000, 0.25, () => 0)).toBe(750);
  });

  it('produces no offset when rng returns 0.5', () => {
    expect(applyJitter(1000, 0.25, () => 0.5)).toBe(1000);
  });

  it('clamps negative results to zero', () => {
    expect(applyJitter(100, 2, () => 0)).toBe(0);
  });

  it('keeps jittered values within the expected bounds over many samples', () => {
    const baseDelay = 1000;
    const jitterFactor = 0.25;
    const samples = Array.from({ length: 100 }, () =>
      applyJitter(baseDelay, jitterFactor, Math.random),
    );
    for (const sample of samples) {
      expect(sample).toBeGreaterThanOrEqual(750);
      expect(sample).toBeLessThanOrEqual(1250);
    }
  });
});
