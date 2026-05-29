import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleGetCostSummary } from '../../src/tools/cost-summary.js';
import { handleDetectAnomalies } from '../../src/tools/anomalies.js';
import { handleListRecommendations } from '../../src/tools/recommendations.js';
import { handleGetCostForecast } from '../../src/tools/forecast.js';

/**
 * Tests that provider errors are caught and returned as generic isError
 * responses (not thrown, not leaking raw SDK error details).
 */

function makeAzureClient(overrides: Record<string, any> = {}) {
  return {
    queryCosts: vi.fn(),
    forecastCosts: vi.fn(),
    getRecommendations: vi.fn(),
    ...overrides,
  };
}

const GENERIC_ERROR = 'azure request failed';

// withProvider logs the underlying error via console.error so operators can
// diagnose intermittent Azure failures the LLM client never sees. The tests
// below assert error masking and isError shape — we silence the operator log
// to keep test output clean, and let dedicated tests assert on it explicitly.
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('Azure API error handling', () => {
  describe('401 Unauthorized', () => {
    const authError = Object.assign(
      new Error('Authentication failed: invalid client credentials'),
      { statusCode: 401, code: 'AuthenticationFailed' },
    );

    it('get_cost_summary returns isError with generic message', async () => {
      const client = makeAzureClient({ queryCosts: vi.fn().mockRejectedValue(authError) });
      const result = await handleGetCostSummary(
        { provider: 'azure', start_date: '2026-03-01', end_date: '2026-03-31', group_by: 'service' },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(GENERIC_ERROR);
    });

    it('detect_anomalies returns isError with generic message', async () => {
      const client = makeAzureClient({ queryCosts: vi.fn().mockRejectedValue(authError) });
      const result = await handleDetectAnomalies(
        { provider: 'azure', days: 7, threshold: 20 },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(GENERIC_ERROR);
    });

    it('list_recommendations returns isError with generic message', async () => {
      const client = makeAzureClient({ getRecommendations: vi.fn().mockRejectedValue(authError) });
      const result = await handleListRecommendations(
        { provider: 'azure', category: 'all' },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(GENERIC_ERROR);
    });

    it('get_cost_forecast returns isError with generic message', async () => {
      const client = makeAzureClient({ forecastCosts: vi.fn().mockRejectedValue(authError) });
      const result = await handleGetCostForecast(
        { provider: 'azure', days: 30 },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(GENERIC_ERROR);
    });
  });

  describe('429 Rate Limited', () => {
    const rateLimitError = Object.assign(
      new Error('Too many requests. Retry after 30 seconds.'),
      { statusCode: 429, code: 'TooManyRequests' },
    );

    it('get_cost_summary returns isError for rate limiting', async () => {
      const client = makeAzureClient({ queryCosts: vi.fn().mockRejectedValue(rateLimitError) });
      const result = await handleGetCostSummary(
        { provider: 'azure', start_date: '2026-03-01', end_date: '2026-03-31', group_by: 'service' },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(GENERIC_ERROR);
    });

    it('detect_anomalies returns isError for rate limiting', async () => {
      const client = makeAzureClient({ queryCosts: vi.fn().mockRejectedValue(rateLimitError) });
      const result = await handleDetectAnomalies(
        { provider: 'azure', days: 7, threshold: 20 },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(GENERIC_ERROR);
    });
  });

  describe('500 Internal Server Error', () => {
    const serverError = Object.assign(
      new Error('Internal server error'),
      { statusCode: 500, code: 'InternalServerError' },
    );

    it('get_cost_summary returns isError for server failure', async () => {
      const client = makeAzureClient({ queryCosts: vi.fn().mockRejectedValue(serverError) });
      const result = await handleGetCostSummary(
        { provider: 'azure', start_date: '2026-03-01', end_date: '2026-03-31', group_by: 'service' },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(GENERIC_ERROR);
    });

    it('list_recommendations returns isError for server failure', async () => {
      const client = makeAzureClient({ getRecommendations: vi.fn().mockRejectedValue(serverError) });
      const result = await handleListRecommendations(
        { provider: 'azure', category: 'all' },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(GENERIC_ERROR);
    });
  });

  describe('Timeout', () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'AbortError';

    it('get_cost_summary returns isError on timeout', async () => {
      const client = makeAzureClient({ queryCosts: vi.fn().mockRejectedValue(timeoutError) });
      const result = await handleGetCostSummary(
        { provider: 'azure', start_date: '2026-03-01', end_date: '2026-03-31', group_by: 'service' },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(GENERIC_ERROR);
    });

    it('get_cost_forecast returns isError on timeout', async () => {
      const client = makeAzureClient({ forecastCosts: vi.fn().mockRejectedValue(timeoutError) });
      const result = await handleGetCostForecast(
        { provider: 'azure', days: 30 },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(GENERIC_ERROR);
    });
  });

  describe('Non-Error throws', () => {
    it('handles string thrown instead of Error object', async () => {
      const client = makeAzureClient({ queryCosts: vi.fn().mockRejectedValue('raw string error') });
      const result = await handleGetCostSummary(
        { provider: 'azure', start_date: '2026-03-01', end_date: '2026-03-31', group_by: 'service' },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(GENERIC_ERROR);
    });
  });

  describe('Diagnostic logging (stderr)', () => {
    // The user-facing message is intentionally generic (no raw SDK details).
    // The original error MUST still reach stderr so operators can root-cause
    // intermittent failures the LLM client cannot see.

    it('logs the original error to console.error with the provider tag', async () => {
      const underlying = Object.assign(new Error('Internal server error'), {
        statusCode: 503,
        code: 'ServiceUnavailable',
      });
      const client = makeAzureClient({ queryCosts: vi.fn().mockRejectedValue(underlying) });
      const result = await handleGetCostSummary(
        { provider: 'azure', start_date: '2026-03-01', end_date: '2026-03-31', group_by: 'service' },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(GENERIC_ERROR);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const [tag, errArg] = errorSpy.mock.calls[0] ?? [];
      expect(String(tag)).toContain('[azure]');
      expect(errArg).toBe(underlying);
    });

    it('logs string-shaped throws to stderr too', async () => {
      const client = makeAzureClient({ queryCosts: vi.fn().mockRejectedValue('raw string error') });
      await handleGetCostSummary(
        { provider: 'azure', start_date: '2026-03-01', end_date: '2026-03-31', group_by: 'service' },
        { azure: client as any, gcp: null },
      );
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0]?.[1]).toBe('raw string error');
    });

    it('does NOT log when the provider is unconfigured (no Azure call made)', async () => {
      const result = await handleGetCostSummary(
        { provider: 'azure', start_date: '2026-03-01', end_date: '2026-03-31', group_by: 'service' },
        { azure: null, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('azure is not configured');
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
