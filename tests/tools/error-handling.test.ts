import { describe, it, expect, vi } from 'vitest';
import { handleGetCostSummary } from '../../src/tools/cost-summary.js';
import { handleDetectAnomalies } from '../../src/tools/anomalies.js';
import { handleListRecommendations } from '../../src/tools/recommendations.js';
import { handleGetCostForecast } from '../../src/tools/forecast.js';

/**
 * Tests that Azure API errors are caught and returned as isError responses
 * (not thrown), with useful messages for the user/LLM.
 */

function makeAzureClient(overrides: Record<string, any> = {}) {
  return {
    queryCosts: vi.fn(),
    forecastCosts: vi.fn(),
    getRecommendations: vi.fn(),
    ...overrides,
  };
}

describe('Azure API error handling', () => {
  describe('401 Unauthorized', () => {
    const authError = Object.assign(
      new Error('Authentication failed: invalid client credentials'),
      { statusCode: 401, code: 'AuthenticationFailed' },
    );

    it('get_cost_summary returns isError with auth message', async () => {
      const client = makeAzureClient({ queryCosts: vi.fn().mockRejectedValue(authError) });
      const result = await handleGetCostSummary(
        { provider: 'azure', start_date: '2026-03-01', end_date: '2026-03-31', group_by: 'service' },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Authentication failed');
    });

    it('detect_anomalies returns isError with auth message', async () => {
      const client = makeAzureClient({ queryCosts: vi.fn().mockRejectedValue(authError) });
      const result = await handleDetectAnomalies(
        { provider: 'azure', days: 7, threshold: 20 },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Authentication failed');
    });

    it('list_recommendations returns isError with auth message', async () => {
      const client = makeAzureClient({ getRecommendations: vi.fn().mockRejectedValue(authError) });
      const result = await handleListRecommendations(
        { provider: 'azure', category: 'all' },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Authentication failed');
    });

    it('get_cost_forecast returns isError with auth message', async () => {
      const client = makeAzureClient({ forecastCosts: vi.fn().mockRejectedValue(authError) });
      const result = await handleGetCostForecast(
        { provider: 'azure', days: 30 },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Authentication failed');
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
      expect(result.content[0].text).toContain('Too many requests');
    });

    it('detect_anomalies returns isError for rate limiting', async () => {
      const client = makeAzureClient({ queryCosts: vi.fn().mockRejectedValue(rateLimitError) });
      const result = await handleDetectAnomalies(
        { provider: 'azure', days: 7, threshold: 20 },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Too many requests');
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
      expect(result.content[0].text).toContain('Internal server error');
    });

    it('list_recommendations returns isError for server failure', async () => {
      const client = makeAzureClient({ getRecommendations: vi.fn().mockRejectedValue(serverError) });
      const result = await handleListRecommendations(
        { provider: 'azure', category: 'all' },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Internal server error');
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
      expect(result.content[0].text).toContain('aborted');
    });

    it('get_cost_forecast returns isError on timeout', async () => {
      const client = makeAzureClient({ forecastCosts: vi.fn().mockRejectedValue(timeoutError) });
      const result = await handleGetCostForecast(
        { provider: 'azure', days: 30 },
        { azure: client as any, gcp: null },
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('aborted');
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
      expect(result.content[0].text).toContain('raw string error');
    });
  });
});
