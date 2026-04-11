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

  it('returns azure config with empty strings when no Azure env vars set', async () => {
    const { getConfig } = await import('../src/config.js');
    const config = getConfig();
    expect(config.azure.tenantId).toBe('');
    expect(config.azure.clientId).toBe('');
    expect(config.azure.clientSecret).toBe('');
    expect(config.azure.subscriptionId).toBeUndefined();
  });

  it('parses GCP config from env vars', async () => {
    vi.stubEnv('GCP_PROJECT_ID', 'my-project');
    vi.stubEnv('GCP_BILLING_TABLE', 'my-project.billing.gcp_billing_export_v1_ABCDEF');
    vi.stubEnv('GCP_BILLING_ACCOUNT_ID', '012345-6789AB-CDEF01');

    const { getConfig } = await import('../src/config.js');
    const config = getConfig();

    expect(config.gcp).toEqual({
      projectId: 'my-project',
      billingTable: 'my-project.billing.gcp_billing_export_v1_ABCDEF',
      billingAccountId: '012345-6789AB-CDEF01',
    });
  });

  it('prefers GCP_PROJECT_ID over GOOGLE_CLOUD_PROJECT', async () => {
    vi.stubEnv('GCP_PROJECT_ID', 'override-project');
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'default-project');
    vi.stubEnv('GCP_BILLING_TABLE', 'table');

    const { getConfig } = await import('../src/config.js');
    const config = getConfig();

    expect(config.gcp.projectId).toBe('override-project');
  });

  it('falls back to GOOGLE_CLOUD_PROJECT when GCP_PROJECT_ID is unset', async () => {
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'default-project');
    vi.stubEnv('GCP_BILLING_TABLE', 'table');

    const { getConfig } = await import('../src/config.js');
    const config = getConfig();

    expect(config.gcp.projectId).toBe('default-project');
  });

  it('returns GCP config with empty strings when no GCP env vars set', async () => {
    const { getConfig } = await import('../src/config.js');
    const config = getConfig();
    expect(config.gcp.projectId).toBe('');
    expect(config.gcp.billingTable).toBe('');
    expect(config.gcp.billingAccountId).toBeUndefined();
  });

});
