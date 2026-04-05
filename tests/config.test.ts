import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses Azure config from env vars', async () => {
    vi.stubEnv('AZURE_TENANT_ID', 'tenant-123');
    vi.stubEnv('AZURE_CLIENT_ID', 'client-123');
    vi.stubEnv('AZURE_CLIENT_SECRET', 'secret-123');
    vi.stubEnv('AZURE_SUBSCRIPTION_ID', 'sub-123');

    const { getConfig } = await import('../src/config.js');
    const config = getConfig();

    expect(config.azure).toEqual({
      tenantId: 'tenant-123',
      clientId: 'client-123',
      clientSecret: 'secret-123',
      subscriptionId: 'sub-123',
    });
  });

  it('returns null azure when no Azure env vars set', async () => {
    const { getConfig } = await import('../src/config.js');
    const config = getConfig();
    expect(config.azure).toBeNull();
  });

  it('defaults cache TTL to 300 seconds', async () => {
    const { getConfig } = await import('../src/config.js');
    const config = getConfig();
    expect(config.cacheTtlSeconds).toBe(300);
  });

  it('parses custom cache TTL', async () => {
    vi.stubEnv('CACHE_TTL_SECONDS', '600');
    const { getConfig } = await import('../src/config.js');
    const config = getConfig();
    expect(config.cacheTtlSeconds).toBe(600);
  });
});
