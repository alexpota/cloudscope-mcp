import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleGetCostSummary } from '../../src/tools/cost-summary.js';

const mockAzureClient = {
  queryCosts: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleGetCostSummary', () => {
  it('returns formatted cost table for Azure', async () => {
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [
        { name: 'Virtual Machines', cost: 4231.5 },
        { name: 'Storage', cost: 1050.75 },
      ],
      currency: 'USD',
    });

    const result = await handleGetCostSummary(
      { provider: 'azure', start_date: '2026-03-01', end_date: '2026-03-31', group_by: 'service' },
      { azure: mockAzureClient as any },
    );

    const text = result.content[0].text;
    expect(text).toContain('Virtual Machines');
    expect(text).toContain('$4,231.50');
    expect(text).toContain('TOTAL');
  });

  it('returns error when Azure is not configured', async () => {
    const result = await handleGetCostSummary(
      { provider: 'azure', start_date: '2026-03-01', end_date: '2026-03-31', group_by: 'service' },
      { azure: null },
    );

    expect(result.content[0].text).toContain('not configured');
    expect(result.isError).toBe(true);
  });

  it('maps group_by to correct Azure grouping', async () => {
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [{ name: 'my-rg', cost: 500 }],
      currency: 'USD',
    });

    await handleGetCostSummary(
      { provider: 'azure', start_date: '2026-03-01', end_date: '2026-03-31', group_by: 'resource_group' },
      { azure: mockAzureClient as any },
    );

    expect(mockAzureClient.queryCosts).toHaveBeenCalledWith('2026-03-01', '2026-03-31', 'resource_group');
  });

  it('handles Azure API errors gracefully', async () => {
    mockAzureClient.queryCosts.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await handleGetCostSummary(
      { provider: 'azure', start_date: '2026-03-01', end_date: '2026-03-31', group_by: 'service' },
      { azure: mockAzureClient as any },
    );

    expect(result.content[0].text).toContain('Network timeout');
    expect(result.isError).toBe(true);
  });

  it('rejects invalid date format', async () => {
    const result = await handleGetCostSummary(
      { provider: 'azure', start_date: 'yesterday', end_date: '2026-03-31', group_by: 'service' },
      { azure: mockAzureClient as any },
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid start_date');
    expect(mockAzureClient.queryCosts).not.toHaveBeenCalled();
  });

  it('rejects start_date after end_date', async () => {
    const result = await handleGetCostSummary(
      { provider: 'azure', start_date: '2026-03-31', end_date: '2026-03-01', group_by: 'service' },
      { azure: mockAzureClient as any },
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('after');
  });

  describe('default dates', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 3, 15)); // April 15, 2026
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('defaults to current month when dates omitted', async () => {
      mockAzureClient.queryCosts.mockResolvedValueOnce({
        rows: [{ name: 'VM', cost: 100 }],
        currency: 'USD',
      });

      const result = await handleGetCostSummary(
        { provider: 'azure', group_by: 'service' },
        { azure: mockAzureClient as any },
      );

      expect(mockAzureClient.queryCosts).toHaveBeenCalledWith('2026-04-01', '2026-04-15', 'service');
      expect(result.content[0].text).toContain('2026-04-01 to 2026-04-15');
    });
  });
});
