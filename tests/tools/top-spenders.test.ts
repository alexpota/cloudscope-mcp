import { describe, it, expect, vi } from 'vitest';
import { handleTopSpendingResources } from '../../src/tools/top-spenders.js';

const mockAzureClient = {
  queryCosts: vi.fn(),
};

describe('handleTopSpendingResources', () => {
  it('returns top N resources sorted by cost', async () => {
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [
        { serviceName: '/subscriptions/s/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/prod-web-01', cost: 800, currency: 'USD' },
        { serviceName: '/subscriptions/s/resourceGroups/rg/providers/Microsoft.Sql/servers/db-main', cost: 1200, currency: 'USD' },
        { serviceName: '/subscriptions/s/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/logs', cost: 200, currency: 'USD' },
      ],
      currency: 'USD',
    });

    const result = await handleTopSpendingResources(
      { provider: 'azure', days: 30, limit: 10 },
      { azure: mockAzureClient as any },
    );

    const text = result.content[0].text;
    expect(text).toContain('Top 3 Resources');
    expect(text).toContain('db-main');
    expect(text).toContain('prod-web-01');
    expect(text).toContain('logs');
    // db-main should be first (highest cost)
    expect(text.indexOf('db-main')).toBeLessThan(text.indexOf('prod-web-01'));
  });

  it('respects the limit parameter', async () => {
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [
        { serviceName: '/a/b/c/res1', cost: 300, currency: 'USD' },
        { serviceName: '/a/b/c/res2', cost: 200, currency: 'USD' },
        { serviceName: '/a/b/c/res3', cost: 100, currency: 'USD' },
      ],
      currency: 'USD',
    });

    const result = await handleTopSpendingResources(
      { provider: 'azure', days: 30, limit: 2 },
      { azure: mockAzureClient as any },
    );

    const text = result.content[0].text;
    expect(text).toContain('Top 2 Resources');
    expect(text).toContain('Showing top 2 of 3 resources');
  });

  it('handles empty result', async () => {
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [],
      currency: 'USD',
    });

    const result = await handleTopSpendingResources(
      { provider: 'azure', days: 30, limit: 10 },
      { azure: mockAzureClient as any },
    );

    expect(result.content[0].text).toContain('No resource-level cost data');
  });

  it('returns error when not configured', async () => {
    const result = await handleTopSpendingResources(
      { provider: 'azure', days: 30, limit: 10 },
      { azure: null },
    );

    expect(result.isError).toBe(true);
  });
});
