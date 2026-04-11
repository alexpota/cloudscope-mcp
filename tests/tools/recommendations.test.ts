import { describe, it, expect, vi } from 'vitest';
import { handleListRecommendations } from '../../src/tools/recommendations.js';

const mockAzureClient = {
  getRecommendations: vi.fn(),
};

describe('handleListRecommendations', () => {
  it('returns formatted recommendations', async () => {
    mockAzureClient.getRecommendations.mockResolvedValueOnce([
      {
        id: 'rec-1',
        category: 'Cost',
        impact: 'High',
        description: 'Right-size VM instance-xyz from D4 to D2',
        savingsAmount: 150.0,
        savingsCurrency: 'USD',
        resourceId:
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm1',
      },
      {
        id: 'rec-2',
        category: 'Cost',
        impact: 'Medium',
        description: 'Delete unused public IP address',
        savingsAmount: 3.65,
        savingsCurrency: 'USD',
        resourceId:
          '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Network/publicIPAddresses/ip1',
      },
    ]);

    const result = await handleListRecommendations(
      { provider: 'azure', category: 'all' },
      { azure: mockAzureClient as any, gcp: null },
    );

    const text = result.content[0].text;
    expect(text).toContain('Right-size VM');
    expect(text).toContain('$150.00');
    expect(text).toContain('Delete unused public IP');
    expect(text).toContain('2 recommendation(s)');
  });

  it('reports when no recommendations found', async () => {
    mockAzureClient.getRecommendations.mockResolvedValueOnce([]);

    const result = await handleListRecommendations(
      { provider: 'azure', category: 'all' },
      { azure: mockAzureClient as any, gcp: null },
    );

    expect(result.content[0].text).toContain('No cost optimization recommendations');
  });

  it('returns error when azure is not configured', async () => {
    const result = await handleListRecommendations(
      { provider: 'azure', category: 'all' },
      { azure: null, gcp: null },
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not configured');
  });

  it('sorts recommendations by savings amount descending', async () => {
    mockAzureClient.getRecommendations.mockResolvedValueOnce([
      { id: 'low', category: 'Cost', impact: 'Low', description: 'Small saving', savingsAmount: 5.0, savingsCurrency: 'USD' },
      { id: 'high', category: 'Cost', impact: 'High', description: 'Big saving', savingsAmount: 500.0, savingsCurrency: 'USD' },
    ]);

    const result = await handleListRecommendations(
      { provider: 'azure', category: 'all' },
      { azure: mockAzureClient as any, gcp: null },
    );

    const text = result.content[0].text;
    const bigIndex = text.indexOf('Big saving');
    const smallIndex = text.indexOf('Small saving');
    expect(bigIndex).toBeLessThan(smallIndex);
  });

  it('handles recommendations without savings amount', async () => {
    mockAzureClient.getRecommendations.mockResolvedValueOnce([
      { id: 'no-savings', category: 'Cost', impact: 'Medium', description: 'Review unused resource' },
    ]);

    const result = await handleListRecommendations(
      { provider: 'azure', category: 'all' },
      { azure: mockAzureClient as any, gcp: null },
    );

    const text = result.content[0].text;
    expect(text).toContain('Review unused resource');
    expect(text).toContain('1 recommendation(s)');
    expect(result.isError).toBeUndefined();
  });
});
