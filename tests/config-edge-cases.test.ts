import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('config edge cases', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('partial Azure config: subscription set but no tenant/client/secret', async () => {
    vi.stubEnv('AZURE_SUBSCRIPTION_ID', 'sub-123');
    // Deliberately NOT setting AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET

    const { getConfig } = await import('../src/config.js');
    const config = getConfig();

    // Should still return an Azure config (DefaultAzureCredential handles auth)
    expect(config.azure).not.toBeNull();
    expect(config.azure!.subscriptionId).toBe('sub-123');
    expect(config.azure!.tenantId).toBe('');
    expect(config.azure!.clientId).toBe('');
    expect(config.azure!.clientSecret).toBe('');
  });

});
