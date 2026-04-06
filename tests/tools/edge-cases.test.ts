import { describe, it, expect, vi } from 'vitest';
import { handleGetCostSummary } from '../../src/tools/cost-summary.js';
import { handleDetectAnomalies } from '../../src/tools/anomalies.js';

function makeAzureClient(overrides: Record<string, any> = {}) {
  return {
    queryCosts: vi.fn(),
    forecastCosts: vi.fn(),
    getRecommendations: vi.fn(),
    ...overrides,
  };
}

describe('Edge cases', () => {
  describe('Zero-cost / empty dataset from Azure', () => {
    it('get_cost_summary handles zero rows gracefully', async () => {
      const client = makeAzureClient({
        queryCosts: vi.fn().mockResolvedValue({ rows: [], currency: 'USD' }),
      });

      const result = await handleGetCostSummary(
        { provider: 'azure', start_date: '2026-03-01', end_date: '2026-03-31', group_by: 'service' },
        { azure: client as any },
      );

      expect(result.isError).toBeUndefined();
      const text = result.content[0].text;
      expect(text).toContain('TOTAL');
      expect(text).toContain('$0.00');
    });

    it('detect_anomalies handles zero rows in both periods', async () => {
      const client = makeAzureClient({
        queryCosts: vi.fn()
          .mockResolvedValueOnce({ rows: [], currency: 'USD' })
          .mockResolvedValueOnce({ rows: [], currency: 'USD' }),
      });

      const result = await handleDetectAnomalies(
        { provider: 'azure', days: 7, threshold: 20 },
        { azure: client as any },
      );

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('No anomalies');
    });
  });

  describe('New service appears in current period (no previous cost)', () => {
    it('detect_anomalies flags new service as 100% increase', async () => {
      const client = makeAzureClient({
        queryCosts: vi.fn()
          .mockResolvedValueOnce({
            rows: [
              { serviceName: 'Existing', cost: 100, currency: 'USD' },
              { serviceName: 'BrandNew', cost: 500, currency: 'USD' },
            ],
            currency: 'USD',
          })
          .mockResolvedValueOnce({
            rows: [
              { serviceName: 'Existing', cost: 100, currency: 'USD' },
            ],
            currency: 'USD',
          }),
      });

      const result = await handleDetectAnomalies(
        { provider: 'azure', days: 7, threshold: 20 },
        { azure: client as any },
      );

      const text = result.content[0].text;
      expect(text).toContain('BrandNew');
      expect(text).toContain('100.0%');
    });
  });

  describe('start_date after end_date', () => {
    it('get_cost_summary rejects with error before calling Azure', async () => {
      const client = makeAzureClient({
        queryCosts: vi.fn().mockResolvedValue({ rows: [], currency: 'USD' }),
      });

      const result = await handleGetCostSummary(
        { provider: 'azure', start_date: '2026-03-31', end_date: '2026-03-01', group_by: 'service' },
        { azure: client as any },
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('after');
      expect(client.queryCosts).not.toHaveBeenCalled();
    });
  });

  describe('Concurrent tool calls', () => {
    it('two simultaneous get_cost_summary calls both resolve correctly', async () => {
      const client = makeAzureClient({
        queryCosts: vi.fn()
          .mockResolvedValueOnce({
            rows: [{ serviceName: 'Call1Service', cost: 100, currency: 'USD' }],
            currency: 'USD',
          })
          .mockResolvedValueOnce({
            rows: [{ serviceName: 'Call2Service', cost: 200, currency: 'USD' }],
            currency: 'USD',
          }),
      });

      const providers = { azure: client as any };

      const [result1, result2] = await Promise.all([
        handleGetCostSummary(
          { provider: 'azure', start_date: '2026-01-01', end_date: '2026-01-31', group_by: 'service' },
          providers,
        ),
        handleGetCostSummary(
          { provider: 'azure', start_date: '2026-02-01', end_date: '2026-02-28', group_by: 'service' },
          providers,
        ),
      ]);

      expect(result1.content[0].text).toContain('Call1Service');
      expect(result2.content[0].text).toContain('Call2Service');
      expect(client.queryCosts).toHaveBeenCalledTimes(2);
    });

    it('one failing call does not affect the other', async () => {
      const client = makeAzureClient({
        queryCosts: vi.fn()
          .mockRejectedValueOnce(new Error('First call fails'))
          .mockResolvedValueOnce({
            rows: [{ serviceName: 'OK', cost: 100, currency: 'USD' }],
            currency: 'USD',
          }),
      });

      const providers = { azure: client as any };

      const [result1, result2] = await Promise.all([
        handleGetCostSummary(
          { provider: 'azure', start_date: '2026-01-01', end_date: '2026-01-31', group_by: 'service' },
          providers,
        ),
        handleGetCostSummary(
          { provider: 'azure', start_date: '2026-02-01', end_date: '2026-02-28', group_by: 'service' },
          providers,
        ),
      ]);

      expect(result1.isError).toBe(true);
      expect(result1.content[0].text).toContain('First call fails');
      expect(result2.isError).toBeUndefined();
      expect(result2.content[0].text).toContain('OK');
    });
  });
});
