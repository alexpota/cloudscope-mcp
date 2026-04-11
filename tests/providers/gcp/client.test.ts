import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();

vi.mock('@google-cloud/bigquery', () => ({
  BigQuery: vi.fn().mockImplementation(() => ({
    query: mockQuery,
  })),
}));

import { GcpCostClient } from '../../../src/providers/gcp/client.js';

function createClient() {
  return new GcpCostClient({
    projectId: 'test-project',
    billingTable: 'test-project.billing.gcp_billing_export_v1_ABCDEF',
  });
}

describe('GcpCostClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queryCosts', () => {
    it('returns parsed cost rows from BigQuery response', async () => {
      mockQuery.mockResolvedValueOnce([
        [
          { name: 'Compute Engine', cost: 450.5, currency: 'USD' },
          { name: 'Cloud Storage', cost: 120.25, currency: 'USD' },
        ],
      ]);

      const client = createClient();
      const result = await client.queryCosts('2026-04-01', '2026-04-10', 'service');

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ name: 'Compute Engine', cost: 450.5 });
      expect(result.rows[1]).toEqual({ name: 'Cloud Storage', cost: 120.25 });
      expect(result.currency).toBe('USD');
    });

    it('passes the correct grouping column for service', async () => {
      mockQuery.mockResolvedValueOnce([[]]);

      const client = createClient();
      await client.queryCosts('2026-04-01', '2026-04-10', 'service');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('service.description AS name'),
          params: { startDate: '2026-04-01', endDate: '2026-04-10' },
        }),
      );
    });

    it('passes the correct grouping column for resource_group (project.id)', async () => {
      mockQuery.mockResolvedValueOnce([[]]);

      const client = createClient();
      await client.queryCosts('2026-04-01', '2026-04-10', 'resource_group');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('project.id AS name'),
        }),
      );
    });

    it('passes the correct grouping column for region', async () => {
      mockQuery.mockResolvedValueOnce([[]]);

      const client = createClient();
      await client.queryCosts('2026-04-01', '2026-04-10', 'region');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('location.region AS name'),
        }),
      );
    });

    it('returns empty rows for resource_id when detailed export is not available', async () => {
      const client = createClient();
      // hasDetailedExport defaults to false
      const result = await client.queryCosts('2026-04-01', '2026-04-10', 'resource_id');

      expect(result.rows).toHaveLength(0);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns USD as default currency when no rows returned', async () => {
      mockQuery.mockResolvedValueOnce([[]]);

      const client = createClient();
      const result = await client.queryCosts('2026-04-01', '2026-04-10', 'service');

      expect(result.currency).toBe('USD');
    });

    it('caches identical queries', async () => {
      mockQuery.mockResolvedValue([
        [{ name: 'Compute Engine', cost: 100, currency: 'USD' }],
      ]);

      const client = createClient();
      await client.queryCosts('2026-04-01', '2026-04-10', 'service');
      await client.queryCosts('2026-04-01', '2026-04-10', 'service');

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('treats different groupings as separate cache entries', async () => {
      mockQuery.mockResolvedValue([
        [{ name: 'val', cost: 100, currency: 'USD' }],
      ]);

      const client = createClient();
      await client.queryCosts('2026-04-01', '2026-04-10', 'service');
      await client.queryCosts('2026-04-01', '2026-04-10', 'region');

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('interpolates the billing table name into the query', async () => {
      mockQuery.mockResolvedValueOnce([[]]);

      const client = createClient();
      await client.queryCosts('2026-04-01', '2026-04-10', 'service');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining(
            'test-project.billing.gcp_billing_export_v1_ABCDEF',
          ),
        }),
      );
    });
  });

  describe('queryCostsByTag', () => {
    it('returns cost rows grouped by tag value', async () => {
      mockQuery.mockResolvedValueOnce([
        [
          { name: 'production', cost: 800, currency: 'USD' },
          { name: 'staging', cost: 200, currency: 'USD' },
        ],
      ]);

      const client = createClient();
      const result = await client.queryCostsByTag('2026-04-01', '2026-04-10', 'environment');

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ name: 'production', cost: 800 });
    });

    it('passes tagKey as a BigQuery parameter', async () => {
      mockQuery.mockResolvedValueOnce([[]]);

      const client = createClient();
      await client.queryCostsByTag('2026-04-01', '2026-04-10', 'team');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ tagKey: 'team' }),
        }),
      );
    });
  });

  describe('forecastCosts', () => {
    it('returns actual + forecast rows using linear regression', async () => {
      // Historical data: 30 daily cost rows with linear trend (100, 110, 120, ...)
      const historyRows = Array.from({ length: 30 }, (_, i) => ({
        date: `2026-03-${String(i + 1).padStart(2, '0')}`,
        cost: 100 + i * 10,
        currency: 'USD',
      }));
      mockQuery.mockResolvedValueOnce([historyRows]);

      const client = createClient();
      const result = await client.forecastCosts('2026-03-31', '2026-04-07');

      // Should have 30 actual + 7 forecast
      const actuals = result.rows.filter((r) => r.costType === 'Actual');
      const forecasts = result.rows.filter((r) => r.costType === 'Forecast');

      expect(actuals.length).toBe(30);
      expect(forecasts.length).toBe(7);
      expect(result.currency).toBe('USD');
      // Forecasts should be increasing (positive slope)
      expect(forecasts[0]!.cost).toBeGreaterThan(actuals[actuals.length - 1]!.cost);
    });

    it('returns empty rows when no historical data', async () => {
      mockQuery.mockResolvedValueOnce([[]]);

      const client = createClient();
      const result = await client.forecastCosts('2026-04-01', '2026-04-07');

      expect(result.rows).toHaveLength(0);
      expect(result.currency).toBe('USD');
    });

    it('caches identical forecast requests', async () => {
      mockQuery.mockResolvedValue([
        [
          { date: '2026-03-30', cost: 100, currency: 'USD' },
          { date: '2026-03-31', cost: 110, currency: 'USD' },
        ],
      ]);

      const client = createClient();
      await client.forecastCosts('2026-03-31', '2026-04-03');
      await client.forecastCosts('2026-03-31', '2026-04-03');

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('validate', () => {
    it('returns connected: true when BigQuery query succeeds', async () => {
      // First call: validate query
      mockQuery.mockResolvedValueOnce([[{ ok: 1 }]]);
      // Second call: detailed export probe
      mockQuery.mockResolvedValueOnce([[]]);

      const client = createClient();
      const result = await client.validate();

      expect(result.connected).toBe(true);
      expect(result.detail).toContain('test-project');
      expect(result.detail).toContain('detailed');
    });

    it('returns connected: false when BigQuery fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Table not found'));

      const client = createClient();
      const result = await client.validate();

      expect(result.connected).toBe(false);
      expect(result.detail).toContain('Table not found');
    });

    it('detects standard export when detailed probe fails', async () => {
      mockQuery.mockResolvedValueOnce([[{ ok: 1 }]]);
      mockQuery.mockRejectedValueOnce(new Error('Unrecognized name: resource'));

      const client = createClient();
      const result = await client.validate();

      expect(result.connected).toBe(true);
      expect(result.detail).toContain('standard');
    });

    it('enables resource_id grouping after detecting detailed export', async () => {
      // validate: success + detailed probe success
      mockQuery.mockResolvedValueOnce([[{ ok: 1 }]]);
      mockQuery.mockResolvedValueOnce([[]]);

      const client = createClient();
      await client.validate();

      // Now resource_id should work
      mockQuery.mockResolvedValueOnce([
        [{ name: 'projects/p/instances/vm-1', cost: 50, currency: 'USD' }],
      ]);
      const result = await client.queryCosts('2026-04-01', '2026-04-10', 'resource_id');

      expect(result.rows).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });
  });

  describe('not yet implemented methods', () => {
    it('getRecommendations throws', async () => {
      const client = createClient();
      await expect(client.getRecommendations()).rejects.toThrow('not yet implemented');
    });

    it('listBudgets throws', async () => {
      const client = createClient();
      await expect(client.listBudgets()).rejects.toThrow('not yet implemented');
    });

    it('findIdleResources throws', async () => {
      const client = createClient();
      await expect(client.findIdleResources()).rejects.toThrow('not yet implemented');
    });

    it('findUntaggedResources throws', async () => {
      const client = createClient();
      await expect(client.findUntaggedResources()).rejects.toThrow('not yet implemented');
    });
  });
});
