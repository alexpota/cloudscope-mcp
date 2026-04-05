export interface AzureConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
}

export interface GcpConfig {
  projectId: string;
  billingTable: string;
}

export interface AppConfig {
  azure: AzureConfig | null;
  gcp: GcpConfig | null;
  cacheTtlSeconds: number;
  logLevel: string;
}

export function getConfig(): AppConfig {
  const azure = getAzureConfig();
  const gcp = getGcpConfig();
  return {
    azure,
    gcp,
    cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}

function getAzureConfig(): AzureConfig | null {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;

  if (!subscriptionId) return null;

  return {
    tenantId: tenantId || '',
    clientId: clientId || '',
    clientSecret: clientSecret || '',
    subscriptionId,
  };
}

function getGcpConfig(): GcpConfig | null {
  const projectId = process.env.GCP_PROJECT_ID;
  const billingTable = process.env.GCP_BILLING_TABLE;

  if (!projectId || !billingTable) return null;

  return { projectId, billingTable };
}
