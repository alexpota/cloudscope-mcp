import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
const mockListRecommendations = vi.fn();
const mockListZones = vi.fn();
const mockListBudgets = vi.fn();

vi.mock('@google-cloud/bigquery', () => ({
  BigQuery: vi.fn().mockImplementation(() => ({
    query: mockQuery,
  })),
}));

vi.mock('@google-cloud/recommender', () => ({
  RecommenderClient: vi.fn().mockImplementation(() => ({
    listRecommendations: mockListRecommendations,
  })),
}));

vi.mock('@google-cloud/compute', () => ({
  ZonesClient: vi.fn().mockImplementation(() => ({
    list: mockListZones,
  })),
}));

vi.mock('@google-cloud/billing-budgets', () => ({
  BudgetServiceClient: vi.fn().mockImplementation(() => ({
    listBudgets: mockListBudgets,
  })),
}));

const mockSearchAllResources = vi.fn();

vi.mock('@google-cloud/asset', () => ({
  AssetServiceClient: vi.fn().mockImplementation(() => ({
    searchAllResources: mockSearchAllResources,
  })),
}));

import { GcpCostClient } from '../../../src/providers/gcp/client.js';

function createClient(billingAccountId?: string) {
  return new GcpCostClient({
    projectId: 'test-project',
    billingTable: 'test-project.billing.gcp_billing_export_v1_ABCDEF',
    billingAccountId,
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

  describe('getRecommendations', () => {
    it('returns recommendations from Recommender API', async () => {
      mockListZones.mockResolvedValueOnce([
        [{ name: 'us-central1-a', status: 'UP' }],
      ]);
      mockListRecommendations.mockResolvedValue([
        [
          {
            name: 'projects/p/locations/us-central1-a/recommenders/google.compute.instance.MachineTypeRecommender/recommendations/rec-1',
            description: 'Resize VM to e2-medium',
            recommenderSubtype: 'CHANGE_MACHINE_TYPE',
            primaryImpact: {
              costProjection: {
                cost: { units: '-50', nanos: 0, currencyCode: 'USD' },
              },
            },
          },
        ],
      ]);

      const client = createClient();
      const recs = await client.getRecommendations();

      expect(recs.length).toBeGreaterThan(0);
      expect(recs[0]?.description).toBe('Resize VM to e2-medium');
      expect(recs[0]?.savingsAmount).toBe(50);
      expect(recs[0]?.category).toBe('Cost');
    });

    it('returns empty array when no zones available', async () => {
      mockListZones.mockRejectedValueOnce(new Error('No compute API'));
      // No zones → no locations → no calls
      mockListRecommendations.mockResolvedValue([[]]);

      const client = createClient();
      const recs = await client.getRecommendations();

      // Should still return (empty) without throwing
      expect(recs).toEqual([]);
    });
  });

  describe('findIdleResources', () => {
    it('returns idle resources from Recommender API', async () => {
      mockListZones.mockResolvedValueOnce([
        [{ name: 'us-east1-b', status: 'UP' }],
      ]);
      mockListRecommendations.mockResolvedValue([
        [
          {
            name: 'projects/p/locations/us-east1-b/recommenders/google.compute.disk.IdleResourceRecommender/recommendations/disk-rec',
            description: 'Delete idle persistent disk',
            recommenderSubtype: 'DELETE_DISK',
            primaryImpact: {
              costProjection: {
                cost: { units: '-10', nanos: -500000000, currencyCode: 'USD' },
              },
            },
          },
        ],
      ]);

      const client = createClient();
      const resources = await client.findIdleResources();

      expect(resources.length).toBeGreaterThan(0);
      expect(resources[0]?.reason).toBe('Delete idle persistent disk');
      expect(resources[0]?.estimatedMonthlyCost).toBeCloseTo(10.5, 1);
      expect(resources[0]?.resourceGroup).toBe('test-project');
    });
  });

  describe('listBudgets', () => {
    it('returns empty array when billingAccountId is not set', async () => {
      const client = createClient();
      const budgets = await client.listBudgets();

      expect(budgets).toEqual([]);
      expect(mockListBudgets).not.toHaveBeenCalled();
    });

    it('returns budgets with computed spend from BigQuery', async () => {
      mockListBudgets.mockResolvedValueOnce([
        [
          {
            displayName: 'Monthly Budget',
            amount: {
              specifiedAmount: { units: '5000', currencyCode: 'USD' },
            },
          },
        ],
      ]);
      // BigQuery spend query
      mockQuery.mockResolvedValueOnce([[{ cost: 3200 }]]);

      const client = createClient('012345-6789AB-CDEF01');
      const budgets = await client.listBudgets();

      expect(budgets).toHaveLength(1);
      expect(budgets[0]?.name).toBe('Monthly Budget');
      expect(budgets[0]?.amount).toBe(5000);
      expect(budgets[0]?.currentSpend).toBe(3200);
      expect(budgets[0]?.forecastSpend).toBeGreaterThan(0);
    });

    it('handles BigQuery failure gracefully with zero spend', async () => {
      mockListBudgets.mockResolvedValueOnce([
        [
          {
            displayName: 'Budget',
            amount: { specifiedAmount: { units: '1000', currencyCode: 'EUR' } },
          },
        ],
      ]);
      mockQuery.mockRejectedValueOnce(new Error('BQ error'));

      const client = createClient('012345-6789AB-CDEF01');
      const budgets = await client.listBudgets();

      expect(budgets[0]?.currentSpend).toBe(0);
      expect(budgets[0]?.forecastSpend).toBe(0);
      expect(budgets[0]?.currency).toBe('EUR');
    });
  });

  describe('findUntaggedResources', () => {
    it('returns untagged resources from Asset Inventory API', async () => {
      mockSearchAllResources.mockResolvedValueOnce([
        [
          {
            displayName: 'vm-no-labels',
            name: '//compute.googleapis.com/projects/p/zones/z/instances/vm-no-labels',
            assetType: 'compute.googleapis.com/Instance',
            location: 'us-central1-a',
          },
          {
            name: '//storage.googleapis.com/projects/p/buckets/my-bucket',
            assetType: 'storage.googleapis.com/Bucket',
            location: 'us',
          },
        ],
      ]);

      const client = createClient();
      const resources = await client.findUntaggedResources();

      expect(resources).toHaveLength(2);
      expect(resources[0]).toEqual({
        name: 'vm-no-labels',
        type: 'compute.googleapis.com/Instance',
        resourceGroup: 'test-project',
        location: 'us-central1-a',
      });
      // Falls back to last path segment when no displayName
      expect(resources[1]?.name).toBe('my-bucket');
    });

    it('returns empty array when no untagged resources found', async () => {
      mockSearchAllResources.mockResolvedValueOnce([[]]);

      const client = createClient();
      const resources = await client.findUntaggedResources();

      expect(resources).toEqual([]);
    });
  });
});
