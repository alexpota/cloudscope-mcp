import { describe, it, expect, vi } from 'vitest';
import { handleFindIdleResources } from '../../src/tools/idle-resources.js';

const mockClient = {
  findIdleResources: vi.fn(),
};

describe('handleFindIdleResources', () => {
  it('returns formatted table of idle resources with cost estimates', async () => {
    mockClient.findIdleResources.mockResolvedValueOnce([
      { name: 'disk-1', type: 'microsoft.compute/disks', resourceGroup: 'rg-prod', reason: 'Unattached disk', estimatedMonthlyCost: 45.50, currency: 'USD' },
      { name: 'nic-orphan', type: 'microsoft.network/networkinterfaces', resourceGroup: 'rg-dev', reason: 'Orphaned network interface', estimatedMonthlyCost: 0, currency: 'USD' },
    ]);

    const result = await handleFindIdleResources(
      { provider: 'azure' },
      { azure: mockClient as any },
    );

    const text = result.content[0].text;
    expect(text).toContain('disk-1');
    expect(text).toContain('nic-orphan');
    expect(text).toContain('Unattached disk');
    expect(text).toContain('$45.50');
    expect(text).toContain('2 found');
  });

  it('returns message when no idle resources found', async () => {
    mockClient.findIdleResources.mockResolvedValueOnce([]);

    const result = await handleFindIdleResources(
      { provider: 'azure' },
      { azure: mockClient as any },
    );

    expect(result.content[0].text).toContain('No idle resources found');
  });

  it('returns error when not configured', async () => {
    const result = await handleFindIdleResources(
      { provider: 'azure' },
      { azure: null },
    );

    expect(result.isError).toBe(true);
  });
});
