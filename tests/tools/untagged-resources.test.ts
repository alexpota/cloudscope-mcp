import { describe, it, expect, vi } from 'vitest';
import { handleFindUntaggedResources } from '../../src/tools/untagged-resources.js';

const mockClient = {
  findUntaggedResources: vi.fn(),
};

describe('handleFindUntaggedResources', () => {
  it('returns formatted table of untagged resources', async () => {
    mockClient.findUntaggedResources.mockResolvedValueOnce([
      { name: 'vm-test', type: 'microsoft.compute/virtualMachines', resourceGroup: 'rg-dev', location: 'eastus' },
      { name: 'storage-legacy', type: 'microsoft.storage/storageAccounts', resourceGroup: 'rg-prod', location: 'westeurope' },
    ]);

    const result = await handleFindUntaggedResources(
      { provider: 'azure' },
      { azure: mockClient as any, gcp: null },
    );

    const text = result.content[0].text;
    expect(text).toContain('vm-test');
    expect(text).toContain('storage-legacy');
    expect(text).toContain('2 found');
  });

  it('returns message when all resources are tagged', async () => {
    mockClient.findUntaggedResources.mockResolvedValueOnce([]);

    const result = await handleFindUntaggedResources(
      { provider: 'azure' },
      { azure: mockClient as any, gcp: null },
    );

    expect(result.content[0].text).toContain('All resources have tags');
  });

  it('returns error when not configured', async () => {
    const result = await handleFindUntaggedResources(
      { provider: 'azure' },
      { azure: null, gcp: null },
    );

    expect(result.isError).toBe(true);
  });
});
