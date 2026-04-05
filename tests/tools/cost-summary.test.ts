import { describe, it, expect, vi } from 'vitest';
import { handleGetCostSummary } from '../../src/tools/cost-summary.js';

const mockAzureClient = {
  queryCosts: vi.fn(),
};

describe('handleGetCostSummary', () => {
  it('returns formatted cost table for Azure', async () => {
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [
        { serviceName: 'Virtual Machines', cost: 4231.5, currency: 'USD' },
        { serviceName: 'Storage', cost: 1050.75, currency: 'USD' },
      ],
      currency: 'USD',
    });

    const result = await handleGetCostSummary(
      {
        provider: 'azure',
        start_date: '2026-03-01',
        end_date: '2026-03-31',
        group_by: 'service',
      },
      { azure: mockAzureClient as any, gcp: null },
    );

    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    expect(text).toContain('Virtual Machines');
    expect(text).toContain('$4,231.50');
    expect(text).toContain('TOTAL');
  });

  it('returns error when provider not configured', async () => {
    const result = await handleGetCostSummary(
      {
        provider: 'gcp',
        start_date: '2026-03-01',
        end_date: '2026-03-31',
        group_by: 'service',
      },
      { azure: null, gcp: null },
    );

    expect(result.content[0].text).toContain('not configured');
    expect(result.isError).toBe(true);
  });

  it('returns error when Azure is not configured', async () => {
    const result = await handleGetCostSummary(
      {
        provider: 'azure',
        start_date: '2026-03-01',
        end_date: '2026-03-31',
        group_by: 'service',
      },
      { azure: null, gcp: null },
    );

    expect(result.content[0].text).toContain('not configured');
    expect(result.isError).toBe(true);
  });

  it('maps group_by to correct Azure grouping', async () => {
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [
        { serviceName: 'my-rg', cost: 500, currency: 'USD' },
      ],
      currency: 'USD',
    });

    const result = await handleGetCostSummary(
      {
        provider: 'azure',
        start_date: '2026-03-01',
        end_date: '2026-03-31',
        group_by: 'resource_group',
      },
      { azure: mockAzureClient as any, gcp: null },
    );

    expect(mockAzureClient.queryCosts).toHaveBeenCalledWith(
      '2026-03-01',
      '2026-03-31',
      'ResourceGroup',
    );
    expect(result.content[0].text).toContain('Resource Group');
  });

  it('handles Azure API errors gracefully', async () => {
    mockAzureClient.queryCosts.mockRejectedValueOnce(
      new Error('Network timeout'),
    );

    const result = await handleGetCostSummary(
      {
        provider: 'azure',
        start_date: '2026-03-01',
        end_date: '2026-03-31',
        group_by: 'service',
      },
      { azure: mockAzureClient as any, gcp: null },
    );

    expect(result.content[0].text).toContain('Network timeout');
    expect(result.isError).toBe(true);
  });

  it('calculates period days correctly', async () => {
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [
        { serviceName: 'VM', cost: 100, currency: 'USD' },
      ],
      currency: 'USD',
    });

    const result = await handleGetCostSummary(
      {
        provider: 'azure',
        start_date: '2026-03-01',
        end_date: '2026-03-08',
        group_by: 'service',
      },
      { azure: mockAzureClient as any, gcp: null },
    );

    expect(result.content[0].text).toContain('7 days');
  });
});
