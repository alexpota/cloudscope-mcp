/**
 * Rate-limit and retry utilities for APIs that return transient failures
 * (e.g. 429 Too Many Requests). Implements exponential backoff with jitter,
 * bounded maximum delay, and server-hint capping for UX safety.
 */

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 4000;
// ±25% spread per AWS Architecture Blog "Exponential Backoff And Jitter".
const DEFAULT_JITTER_FACTOR = 0.25;
const EXPONENTIAL_BASE = 2;
const MIN_CONCURRENCY = 1;

/**
 * Promise-based sleep using the global `setTimeout` rather than
 * `node:timers/promises.setTimeout` — the global is what vitest's
 * `useFakeTimers()` mocks by default, so tests stay instant.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export interface RateLimiter {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

export interface RateLimiterOptions {
  concurrency: number;
}

/**
 * FIFO concurrency limiter. Each instance owns its queue and counter so
 * multiple limiters can coexist (e.g. one per provider).
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  if (options.concurrency < MIN_CONCURRENCY) {
    throw new Error(
      `concurrency must be >= ${MIN_CONCURRENCY}, got ${options.concurrency}`,
    );
  }

  let active = 0;
  const pending: Array<() => void> = [];

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      if (active >= options.concurrency) {
        await new Promise<void>((resolve) => {
          pending.push(resolve);
        });
      }
      active++;
      try {
        return await fn();
      } finally {
        active--;
        const next = pending.shift();
        if (next) next();
      }
    },
  };
}

/**
 * Pure exponential backoff computation, bounded by `maxDelayMs`. Kept
 * deterministic — jitter is layered separately by `applyJitter`.
 */
export function computeBackoffDelay(options: {
  attempt: number;
  baseDelayMs: number;
  maxDelayMs: number;
}): number {
  return Math.min(
    options.baseDelayMs * EXPONENTIAL_BASE ** options.attempt,
    options.maxDelayMs,
  );
}

/**
 * Applies symmetric jitter to a delay. With `jitterFactor = 0.25`, the
 * result is in `[delay * 0.75, delay * 1.25]`. `jitterFactor = 0` returns
 * the input unchanged. `rng` is injectable for deterministic tests.
 */
export function applyJitter(
  delayMs: number,
  jitterFactor: number,
  rng: () => number = Math.random,
): number {
  if (jitterFactor === 0) return delayMs;
  const offset = delayMs * jitterFactor * (rng() * 2 - 1);
  return Math.max(0, delayMs + offset);
}

export interface RetryOptions {
  /** Required: callers opt in explicitly to retrying specific errors. */
  isRetryable: (err: unknown) => boolean;

  /** Extracts a server-provided retry delay (e.g. from `Retry-After`). */
  extractRetryAfterMs?: (err: unknown) => number | undefined;

  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;

  /** `0` disables jitter, `0.25` = ±25% spread. */
  jitterFactor?: number;

  /** Injectable for deterministic tests; defaults to `Math.random`. */
  rng?: () => number;
}

/**
 * Runs `fn`, retrying on errors matching `isRetryable`. Between attempts,
 * waits for `extractRetryAfterMs` if present, otherwise exponential backoff.
 * Both sources are **capped at `maxDelayMs`** so pathological server hints
 * (e.g. "wait 60s") cannot blow the UX budget. Rethrows after all attempts.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const jitterFactor = options.jitterFactor ?? DEFAULT_JITTER_FACTOR;
  const rng = options.rng ?? Math.random;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === maxAttempts - 1;
      if (isLastAttempt || !options.isRetryable(err)) {
        throw err;
      }
      const retryAfterMs = options.extractRetryAfterMs?.(err);
      const exponentialMs = computeBackoffDelay({ attempt, baseDelayMs, maxDelayMs });
      const cappedDelayMs = Math.min(retryAfterMs ?? exponentialMs, maxDelayMs);
      const finalDelayMs = applyJitter(cappedDelayMs, jitterFactor, rng);
      await delay(finalDelayMs);
    }
  }
  // Unreachable — loop always returns or throws — but needed for TS narrowing.
  throw lastError;
}
