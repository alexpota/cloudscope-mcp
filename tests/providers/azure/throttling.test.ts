import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isAzureThrottlingError, isAzureTransientError } from '../../../src/providers/azure/throttling.js';
import { withRetry } from '../../../src/utils/rate-limit.js';

describe('isAzureThrottlingError', () => {
  it('matches statusCode 429', () => {
    expect(isAzureThrottlingError({ statusCode: 429 })).toBe(true);
  });

  it('matches code "TooManyRequests"', () => {
    expect(isAzureThrottlingError({ code: 'TooManyRequests' })).toBe(true);
  });

  it('matches code "429"', () => {
    expect(isAzureThrottlingError({ code: '429' })).toBe(true);
  });

  it('does NOT match a 503', () => {
    expect(isAzureThrottlingError({ statusCode: 503 })).toBe(false);
  });

  it('does NOT match an auth failure (401)', () => {
    expect(isAzureThrottlingError({ statusCode: 401, code: 'AuthenticationFailed' })).toBe(false);
  });

  it('does NOT match undefined / null', () => {
    expect(isAzureThrottlingError(undefined)).toBe(false);
    expect(isAzureThrottlingError(null)).toBe(false);
  });
});

describe('isAzureTransientError', () => {
  it('matches statusCode 503 (Service Unavailable)', () => {
    expect(isAzureTransientError({ statusCode: 503 })).toBe(true);
  });

  it('matches code "ServiceUnavailable"', () => {
    expect(isAzureTransientError({ code: 'ServiceUnavailable' })).toBe(true);
  });

  it('matches code "ECONNRESET"', () => {
    expect(isAzureTransientError({ code: 'ECONNRESET' })).toBe(true);
  });

  it('matches code "ETIMEDOUT"', () => {
    expect(isAzureTransientError({ code: 'ETIMEDOUT' })).toBe(true);
  });

  it('matches name "AbortError" (operation cancelled by upstream timeout)', () => {
    // AbortError exposes `name`, not `code`. This is the gap the Azure SDK
    // does NOT cover in its default retry policy.
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    expect(isAzureTransientError(err)).toBe(true);
  });

  it('does NOT match a 429 (that belongs to the throttling classifier)', () => {
    expect(isAzureTransientError({ statusCode: 429 })).toBe(false);
  });

  it('does NOT match a 401 auth failure', () => {
    expect(isAzureTransientError({ statusCode: 401, code: 'AuthenticationFailed' })).toBe(false);
  });

  it('does NOT match arbitrary 4xx', () => {
    expect(isAzureTransientError({ statusCode: 400, code: 'BadRequest' })).toBe(false);
    expect(isAzureTransientError({ statusCode: 404, code: 'NotFound' })).toBe(false);
  });
});

describe('combined retry behavior via withRetry', () => {
  // The retry classifier in AzureCostClient.callAzure is:
  //   (err) => isAzureThrottlingError(err) || isAzureTransientError(err)
  // These tests exercise that combined predicate end-to-end through withRetry.
  const isRetryable = (err: unknown): boolean =>
    isAzureThrottlingError(err) || isAzureTransientError(err);

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const retryOpts = {
    isRetryable,
    maxAttempts: 5,
    baseDelayMs: 10,
    maxDelayMs: 100,
    jitterFactor: 0,
  };

  // Helpers: kick off the timers drain in parallel with the awaited promise.
  // `runAllTimersAsync` advances scheduled backoffs (and any newly scheduled
  // during their callbacks), unblocking withRetry's between-attempt delays.
  async function expectResolved<T>(promise: Promise<T>): Promise<T> {
    const timers = vi.runAllTimersAsync();
    const result = await promise;
    await timers;
    return result;
  }

  async function expectRejected(promise: Promise<unknown>, expected: unknown): Promise<void> {
    const timers = vi.runAllTimersAsync();
    await expect(promise).rejects.toBe(expected);
    await timers;
  }

  it('503 triggers a retry and succeeds on the second attempt', async () => {
    const error = Object.assign(new Error('Internal server error'), {
      statusCode: 503,
      code: 'ServiceUnavailable',
    });
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('ok');

    const result = await expectResolved(withRetry(fn, retryOpts));

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('ECONNRESET triggers a retry and succeeds on the second attempt', async () => {
    const error = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('ok');

    const result = await expectResolved(withRetry(fn, retryOpts));

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('AbortError triggers a retry and succeeds on the second attempt', async () => {
    // The Azure SDK does NOT retry AbortError. This is the net-new coverage.
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('ok');

    const result = await expectResolved(withRetry(fn, retryOpts));

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('401 fast-fails without retry', async () => {
    const error = Object.assign(new Error('Authentication failed'), {
      statusCode: 401,
      code: 'AuthenticationFailed',
    });
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(error);

    await expectRejected(withRetry(fn, retryOpts), error);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exhausts the cap and rethrows after max attempts of 503s', async () => {
    const error = Object.assign(new Error('Internal server error'), { statusCode: 503 });
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(error);

    await expectRejected(withRetry(fn, { ...retryOpts, maxAttempts: 3 }), error);

    expect(fn).toHaveBeenCalledTimes(3);
  });
});
