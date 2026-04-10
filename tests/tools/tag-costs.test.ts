import { describe, it, expect, vi } from 'vitest';
import { handleGetCostByTag } from '../../src/tools/tag-costs.js';

const mockAzureClient = {
  queryCostsByTag: vi.fn(),
};

describe('handleGetCostByTag', () => {
  it('returns formatted cost table grouped by tag value', async () => {
    mockAzureClient.queryCostsByTag.mockResolvedValueOnce({
      rows: [
        { name: 'team-platform', cost: 4000 },
        { name: 'team-data', cost: 1500 },
        { name: 'team-frontend', cost: 800 },
      ],
      currency: 'USD',
    });

    const result = await handleGetCostByTag(
      { provider: 'azure', tag_key: 'team' },
      { azure: mockAzureClient as any },
    );

    const text = result.content[0].text;
    expect(text).toContain('team-platform');
    expect(text).toContain('team-data');
    expect(text).toContain('$4,000.00');
    expect(result.isError).toBeUndefined();
  });

  it('returns message when no tagged costs exist', async () => {
    mockAzureClient.queryCostsByTag.mockResolvedValueOnce({
      rows: [],
      currency: 'USD',
    });

    const result = await handleGetCostByTag(
      { provider: 'azure', tag_key: 'environment' },
      { azure: mockAzureClient as any },
    );

    const text = result.content[0].text;
    expect(text).toContain('No cost data');
  });

  it('returns error for invalid date range', async () => {
    const result = await handleGetCostByTag(
      { provider: 'azure', tag_key: 'team', start_date: '2026-04-10', end_date: '2026-04-01' },
      { azure: mockAzureClient as any },
    );

    expect(result.isError).toBe(true);
  });

  it('returns error when provider is not configured', async () => {
    const result = await handleGetCostByTag(
      { provider: 'azure', tag_key: 'team' },
      { azure: null },
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not configured');
  });

  it('passes the tag key to queryCostsByTag', async () => {
    mockAzureClient.queryCostsByTag.mockResolvedValueOnce({ rows: [], currency: 'USD' });

    await handleGetCostByTag(
      { provider: 'azure', tag_key: 'project' },
      { azure: mockAzureClient as any },
    );

    expect(mockAzureClient.queryCostsByTag).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'project',
    );
  });
});
