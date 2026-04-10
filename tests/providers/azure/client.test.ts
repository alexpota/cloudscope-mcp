import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AzureCostClient as AzureCostClientType } from '../../../src/providers/azure/client.js';

// Mock Azure SDK modules before importing the client
vi.mock('@azure/identity', () => ({
  ClientSecretCredential: vi.fn(),
  DefaultAzureCredential: vi.fn(),
}));

const mockUsage = vi.fn();
const mockForecastUsage = vi.fn();
const mockRecommendationsList = vi.fn();
const mockBudgetsList = vi.fn();

vi.mock('@azure/arm-costmanagement', () => ({
  CostManagementClient: vi.fn().mockImplementation(() => ({
    query: {
      usage: mockUsage,
    },
    forecast: {
      usage: mockForecastUsage,
    },
  })),
}));

vi.mock('@azure/arm-consumption', () => ({
  ConsumptionManagementClient: vi.fn().mockImplementation(() => ({
    budgets: {
      list: mockBudgetsList,
    },
  })),
}));

vi.mock('@azure/arm-advisor', () => ({
  AdvisorManagementClient: vi.fn().mockImplementation(() => ({
    recommendations: {
      list: mockRecommendationsList,
    },
  })),
}));

describe('AzureCostClient', () => {
  let AzureCostClient: typeof AzureCostClientType;
  let client: AzureCostClientType;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset mock defaults — include valid columns so the column guards don't throw.
    mockUsage.mockResolvedValue({
      columns: [
        { name: 'Cost', type: 'Number' },
        { name: 'ServiceName', type: 'String' },
        { name: 'Currency', type: 'String' },
      ],
      rows: [],
    });
    mockForecastUsage.mockResolvedValue({
      columns: [
        { name: 'Cost', type: 'Number' },
        { name: 'UsageDate', type: 'Number' },
        { name: 'CostStatus', type: 'String' },
        { name: 'Currency', type: 'String' },
      ],
      rows: [],
    });
    mockRecommendationsList.mockReturnValue({
      [Symbol.asyncIterator]: async function* () {},
    });
    mockBudgetsList.mockReturnValue({
      [Symbol.asyncIterator]: async function* () {},
    });

    // Dynamic import to get fresh module after mocks are set up
    const mod = await import('../../../src/providers/azure/client.js');
    AzureCostClient = mod.AzureCostClient;

    client = new AzureCostClient({
      tenantId: 'tenant-123',
      clientId: 'client-456',
      clientSecret: 'secret-789',
      subscriptionId: 'sub-abc',
    });
  });

  describe('constructor', () => {
    it('creates client with service principal when all creds provided', async () => {
      const { ClientSecretCredential } = await import('@azure/identity');
      expect(ClientSecretCredential).toHaveBeenCalledWith(
        'tenant-123',
        'client-456',
        'secret-789',
      );
    });

    it('falls back to DefaultAzureCredential when creds are missing', async () => {
      const { DefaultAzureCredential } = await import('@azure/identity');

      new AzureCostClient({
        tenantId: '',
        clientId: '',
        clientSecret: '',
        subscriptionId: 'sub-abc',
      });

      expect(DefaultAzureCredential).toHaveBeenCalled();
    });

    it('implements CloudCostProvider interface', () => {
      expect(typeof client.queryCosts).toBe('function');
      expect(typeof client.forecastCosts).toBe('function');
      expect(typeof client.getRecommendations).toBe('function');
      expect(typeof client.listBudgets).toBe('function');
      expect(typeof client.validate).toBe('function');
    });
  });

  describe('queryCosts', () => {
    it('calls query.usage with correct parameters', async () => {
      mockUsage.mockResolvedValueOnce({
        columns: [
          { name: 'Cost', type: 'Number' },
          { name: 'ServiceName', type: 'String' },
          { name: 'Currency', type: 'String' },
        ],
        rows: [[4231.5, 'Virtual Machines', 'USD']],
      });

      await client.queryCosts('2026-03-01', '2026-03-31', 'ServiceName');

      expect(mockUsage).toHaveBeenCalledWith(
        '/subscriptions/sub-abc',
        expect.objectContaining({
          type: 'ActualCost',
          timeframe: 'Custom',
          timePeriod: {
            from: new Date('2026-03-01'),
            to: new Date('2026-03-31'),
          },
          dataset: expect.objectContaining({
            granularity: 'None',
            grouping: [{ type: 'Dimension', name: 'ServiceName' }],
          }),
        }),
      );
    });

    it('returns parsed cost rows sorted from API response', async () => {
      mockUsage.mockResolvedValueOnce({
        columns: [
          { name: 'Cost', type: 'Number' },
          { name: 'ServiceName', type: 'String' },
          { name: 'Currency', type: 'String' },
        ],
        rows: [
          [4231.5, 'Virtual Machines', 'USD'],
          [2100.0, 'Azure SQL Database', 'USD'],
          [890.0, 'Azure Kubernetes Service', 'USD'],
        ],
      });

      const result = await client.queryCosts(
        '2026-03-01',
        '2026-03-31',
        'ServiceName',
      );

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0]).toEqual({
        name: 'Virtual Machines',
        cost: 4231.5,

      });
      expect(result.rows[1]).toEqual({
        name: 'Azure SQL Database',
        cost: 2100.0,

      });
      expect(result.rows[2]).toEqual({
        name: 'Azure Kubernetes Service',
        cost: 890.0,

      });
      expect(result.currency).toBe('USD');
    });

    it('handles empty result from API', async () => {
      mockUsage.mockResolvedValueOnce({
        columns: [
          { name: 'Cost', type: 'Number' },
          { name: 'ServiceName', type: 'String' },
          { name: 'Currency', type: 'String' },
        ],
        rows: [],
      });

      const result = await client.queryCosts(
        '2026-03-01',
        '2026-03-31',
        'ServiceName',
      );

      expect(result.rows).toHaveLength(0);
      expect(result.currency).toBe('USD');
    });

    it('throws a descriptive error when response columns are missing', async () => {
      mockUsage.mockResolvedValueOnce({ columns: [], rows: [] });

      await expect(
        client.queryCosts('2026-03-01', '2026-03-31', 'ServiceName'),
      ).rejects.toThrow('Azure response missing column');
    });

    it('supports ResourceGroup grouping', async () => {
      mockUsage.mockResolvedValueOnce({
        columns: [
          { name: 'Cost', type: 'Number' },
          { name: 'ResourceGroup', type: 'String' },
          { name: 'Currency', type: 'String' },
        ],
        rows: [[1500.0, 'rg-production', 'USD']],
      });

      const result = await client.queryCosts(
        '2026-03-01',
        '2026-03-31',
        'ResourceGroup',
      );

      expect(result.rows[0].name).toBe('rg-production');
      expect(mockUsage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          dataset: expect.objectContaining({
            grouping: [{ type: 'Dimension', name: 'ResourceGroup' }],
          }),
        }),
      );
    });
  });

  describe('getRecommendations', () => {
    it('returns only Cost category recommendations', async () => {
      mockRecommendationsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'rec-1',
            category: 'Cost',
            impact: 'High',
            shortDescription: { solution: 'Right-size VM from D4 to D2' },
            extendedProperties: {
              savingsAmount: '150.00',
              savingsCurrency: 'USD',
            },
            resourceMetadata: {
              resourceId: '/subscriptions/sub/vms/vm1',
            },
          };
          yield {
            id: 'rec-2',
            category: 'Security',
            impact: 'Medium',
            shortDescription: { solution: 'Enable MFA' },
          };
          yield {
            id: 'rec-3',
            category: 'Cost',
            impact: 'Medium',
            shortDescription: {
              solution: 'Delete unused storage account',
            },
            extendedProperties: {
              savingsAmount: '25.50',
              savingsCurrency: 'USD',
            },
            resourceMetadata: {
              resourceId: '/subscriptions/sub/storage/sa1',
            },
          };
        },
      });

      const recs = await client.getRecommendations('all');

      expect(recs).toHaveLength(2);
      expect(recs[0]).toEqual({
        id: 'rec-1',
        category: 'Cost',
        impact: 'High',
        description: 'Right-size VM from D4 to D2',
        savingsAmount: 150.0,
        savingsCurrency: 'USD',
        resourceId: '/subscriptions/sub/vms/vm1',
      });
      expect(recs[1]).toEqual({
        id: 'rec-3',
        category: 'Cost',
        impact: 'Medium',
        description: 'Delete unused storage account',
        savingsAmount: 25.5,
        savingsCurrency: 'USD',
        resourceId: '/subscriptions/sub/storage/sa1',
      });
    });

    it('filters by impactedField resource type prefix when category is not "all"', async () => {
      mockRecommendationsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'rec-1',
            category: 'Cost',
            impact: 'High',
            impactedField: 'Microsoft.Compute/virtualMachines',
            shortDescription: { solution: 'Right-size VM' },
            extendedProperties: {},
            resourceMetadata: {},
          };
          yield {
            id: 'rec-2',
            category: 'Cost',
            impact: 'Medium',
            impactedField: 'Microsoft.Storage/storageAccounts',
            shortDescription: { solution: 'Delete unused storage account' },
            extendedProperties: {},
            resourceMetadata: {},
          };
        },
      });

      const recs = await client.getRecommendations('compute');

      expect(recs).toHaveLength(1);
      expect(recs[0].description).toBe('Right-size VM');
    });

    it('returns empty array when no Cost recommendations exist', async () => {
      mockRecommendationsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'rec-1',
            category: 'Security',
            impact: 'High',
            shortDescription: { solution: 'Enable MFA' },
          };
        },
      });

      const recs = await client.getRecommendations('all');

      expect(recs).toHaveLength(0);
    });

    it('handles recommendation with no extendedProperties', async () => {
      mockRecommendationsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'rec-1',
            category: 'Cost',
            impact: 'Low',
            shortDescription: { problem: 'Unused resources detected' },
          };
        },
      });

      const recs = await client.getRecommendations();

      expect(recs).toHaveLength(1);
      expect(recs[0].description).toBe('Unused resources detected');
      expect(recs[0].savingsAmount).toBeUndefined();
      expect(recs[0].savingsCurrency).toBe('USD');
      expect(recs[0].resourceId).toBeUndefined();
    });

    it('handles recommendation with no shortDescription', async () => {
      mockRecommendationsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'rec-1',
            category: 'Cost',
            impact: 'Low',
          };
        },
      });

      const recs = await client.getRecommendations();

      expect(recs).toHaveLength(1);
      expect(recs[0].description).toBe('No description');
    });
  });

  describe('forecastCosts', () => {
    it('calls forecast.usage with correct parameters', async () => {
      mockForecastUsage.mockResolvedValueOnce({
        columns: [
          { name: 'Cost', type: 'Number' },
          { name: 'UsageDate', type: 'Number' },
          { name: 'CostStatus', type: 'String' },
          { name: 'Currency', type: 'String' },
        ],
        rows: [
          [100.0, 20260401, 'Actual', 'USD'],
          [95.0, 20260402, 'Forecast', 'USD'],
        ],
      });

      await client.forecastCosts('2026-04-01', '2026-04-30');

      expect(mockForecastUsage).toHaveBeenCalledWith(
        '/subscriptions/sub-abc',
        expect.objectContaining({
          type: 'ActualCost',
          timeframe: 'Custom',
          includeActualCost: true,
          dataset: expect.objectContaining({
            granularity: 'Daily',
          }),
        }),
      );
    });

    it('returns parsed forecast rows with cost type', async () => {
      mockForecastUsage.mockResolvedValueOnce({
        columns: [
          { name: 'Cost', type: 'Number' },
          { name: 'UsageDate', type: 'Number' },
          { name: 'CostStatus', type: 'String' },
          { name: 'Currency', type: 'String' },
        ],
        rows: [
          [100.0, 20260401, 'Actual', 'USD'],
          [95.0, 20260402, 'Forecast', 'USD'],
        ],
      });

      const result = await client.forecastCosts('2026-04-01', '2026-04-30');

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({
        date: '20260401',
        cost: 100.0,
        costType: 'Actual',

      });
      expect(result.rows[1]).toEqual({
        date: '20260402',
        cost: 95.0,
        costType: 'Forecast',

      });
      expect(result.currency).toBe('USD');
    });

    it('returns empty rows when forecast has valid columns but no data', async () => {
      mockForecastUsage.mockResolvedValueOnce({
        columns: [
          { name: 'Cost', type: 'Number' },
          { name: 'UsageDate', type: 'Number' },
          { name: 'CostStatus', type: 'String' },
          { name: 'Currency', type: 'String' },
        ],
        rows: [],
      });

      const result = await client.forecastCosts('2026-04-01', '2026-04-30');

      expect(result.rows).toHaveLength(0);
      expect(result.currency).toBe('USD');
    });

    it('throws a descriptive error when forecast columns are missing', async () => {
      mockForecastUsage.mockResolvedValueOnce({ columns: [], rows: [] });

      await expect(
        client.forecastCosts('2026-04-01', '2026-04-30'),
      ).rejects.toThrow('Azure response missing column');
    });
  });

  describe('listBudgets', () => {
    it('returns parsed budgets with spend and forecast', async () => {
      mockBudgetsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            name: 'Production',
            amount: 10000,
            timeGrain: 'Monthly',
            currentSpend: { amount: 7500, unit: 'USD' },
            forecastSpend: { amount: 11000, unit: 'USD' },
          };
        },
      });

      const budgets = await client.listBudgets();

      expect(budgets).toHaveLength(1);
      expect(budgets[0]).toEqual({
        name: 'Production',
        amount: 10000,
        currentSpend: 7500,
        forecastSpend: 11000,
        currency: 'USD',
      });
    });

    it('handles budgets with missing fields', async () => {
      mockBudgetsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {};
        },
      });

      const budgets = await client.listBudgets();

      expect(budgets).toHaveLength(1);
      expect(budgets[0].name).toBe('Unnamed');
      expect(budgets[0].amount).toBe(0);
      expect(budgets[0].currentSpend).toBe(0);
      expect(budgets[0].forecastSpend).toBe(0);
    });

    it('returns empty array when no budgets exist', async () => {
      const budgets = await client.listBudgets();
      expect(budgets).toHaveLength(0);
    });
  });

  describe('queryCostsForScope', () => {
    it('queries the specified scope instead of the default subscription scope', async () => {
      mockUsage.mockResolvedValue({
        columns: [
          { name: 'Cost', type: 'Number' },
          { name: 'ServiceName', type: 'String' },
          { name: 'Currency', type: 'String' },
        ],
        rows: [[500, 'Virtual Machines', 'USD']],
      });

      const customScope = '/subscriptions/different-sub-id';
      await client.queryCostsForScope(customScope, '2026-04-01', '2026-04-09', 'ServiceName');

      expect(mockUsage).toHaveBeenCalledWith(
        customScope,
        expect.objectContaining({ type: 'ActualCost' }),
      );
    });

    it('caches separately per scope', async () => {
      mockUsage.mockResolvedValue({
        columns: [
          { name: 'Cost', type: 'Number' },
          { name: 'ServiceName', type: 'String' },
          { name: 'Currency', type: 'String' },
        ],
        rows: [[100, 'Redis', 'USD']],
      });

      const scopeA = '/subscriptions/sub-a';
      const scopeB = '/subscriptions/sub-b';

      await client.queryCostsForScope(scopeA, '2026-04-01', '2026-04-09', 'ServiceName');
      await client.queryCostsForScope(scopeB, '2026-04-01', '2026-04-09', 'ServiceName');
      await client.queryCostsForScope(scopeA, '2026-04-01', '2026-04-09', 'ServiceName');

      // Two unique scopes = 2 calls. Third call is a cache hit on scopeA.
      expect(mockUsage).toHaveBeenCalledTimes(2);
    });

    it('shares cache with queryCosts when scope matches the default', async () => {
      mockUsage.mockResolvedValue({
        columns: [
          { name: 'Cost', type: 'Number' },
          { name: 'ServiceName', type: 'String' },
          { name: 'Currency', type: 'String' },
        ],
        rows: [[100, 'Redis', 'USD']],
      });

      // queryCosts uses the default scope (/subscriptions/sub-abc)
      await client.queryCosts('2026-04-01', '2026-04-09', 'ServiceName');
      // queryCostsForScope with the same scope should be a cache hit
      await client.queryCostsForScope(
        '/subscriptions/sub-abc',
        '2026-04-01',
        '2026-04-09',
        'ServiceName',
      );

      expect(mockUsage).toHaveBeenCalledTimes(1);
    });
  });

  describe('provider-level caching', () => {
    const sampleCostResponse = {
      columns: [
        { name: 'Cost', type: 'Number' },
        { name: 'ServiceName', type: 'String' },
        { name: 'Currency', type: 'String' },
      ],
      rows: [[100, 'Redis Cache', 'USD']],
    };

    const sampleForecastResponse = {
      columns: [
        { name: 'Cost', type: 'Number' },
        { name: 'UsageDate', type: 'Number' },
        { name: 'CostStatus', type: 'String' },
        { name: 'Currency', type: 'String' },
      ],
      rows: [[100, 20260401, 'Actual', 'USD']],
    };

    it('queryCosts hits the Azure SDK only once for identical sequential calls', async () => {
      mockUsage.mockResolvedValue(sampleCostResponse);

      await client.queryCosts('2026-04-01', '2026-04-09', 'ServiceName');
      await client.queryCosts('2026-04-01', '2026-04-09', 'ServiceName');
      await client.queryCosts('2026-04-01', '2026-04-09', 'ServiceName');

      expect(mockUsage).toHaveBeenCalledTimes(1);
    });

    it('queryCosts coalesces concurrent calls for identical args into a single SDK call', async () => {
      mockUsage.mockResolvedValue(sampleCostResponse);

      await Promise.all([
        client.queryCosts('2026-04-01', '2026-04-09', 'ServiceName'),
        client.queryCosts('2026-04-01', '2026-04-09', 'ServiceName'),
        client.queryCosts('2026-04-01', '2026-04-09', 'ServiceName'),
      ]);

      expect(mockUsage).toHaveBeenCalledTimes(1);
    });

    it('queryCosts treats different args as separate cache entries', async () => {
      // Each grouping returns its own matching columns so the column guard passes.
      mockUsage.mockResolvedValue({
        columns: [
          { name: 'Cost', type: 'Number' },
          { name: 'ServiceName', type: 'String' },
          { name: 'ResourceGroup', type: 'String' },
          { name: 'Currency', type: 'String' },
        ],
        rows: [],
      });

      await client.queryCosts('2026-04-01', '2026-04-09', 'ServiceName');
      await client.queryCosts('2026-04-01', '2026-04-09', 'ResourceGroup');
      await client.queryCosts('2026-03-01', '2026-03-31', 'ServiceName');

      expect(mockUsage).toHaveBeenCalledTimes(3);
    });

    it('queryCosts does not cache an error — the next call retries', async () => {
      mockUsage
        .mockRejectedValueOnce(new Error('transient Azure failure'))
        .mockResolvedValueOnce(sampleCostResponse);

      await expect(
        client.queryCosts('2026-04-01', '2026-04-09', 'ServiceName'),
      ).rejects.toThrow('transient Azure failure');

      const result = await client.queryCosts('2026-04-01', '2026-04-09', 'ServiceName');

      expect(mockUsage).toHaveBeenCalledTimes(2);
      expect(result.rows).toHaveLength(1);
    });

    it('forecastCosts caches identical calls', async () => {
      mockForecastUsage.mockResolvedValue(sampleForecastResponse);

      await client.forecastCosts('2026-04-01', '2026-04-30');
      await client.forecastCosts('2026-04-01', '2026-04-30');

      expect(mockForecastUsage).toHaveBeenCalledTimes(1);
    });

    it('listBudgets caches across repeated calls', async () => {
      mockBudgetsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            name: 'production',
            amount: 200,
            timeGrain: 'Monthly',
            currentSpend: { amount: 0.31, unit: 'USD' },
            forecastSpend: { amount: 0, unit: 'USD' },
          };
        },
      });

      await client.listBudgets();
      await client.listBudgets();

      expect(mockBudgetsList).toHaveBeenCalledTimes(1);
    });

    it('getRecommendations caches across repeated calls with the same category', async () => {
      mockRecommendationsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'rec-1',
            category: 'Cost',
            impact: 'High',
            shortDescription: { solution: 'Right-size VM' },
          };
        },
      });

      await client.getRecommendations('all');
      await client.getRecommendations('all');

      expect(mockRecommendationsList).toHaveBeenCalledTimes(1);
    });
  });
});
