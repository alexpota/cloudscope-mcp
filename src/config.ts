export interface AzureConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
}

export interface AppConfig {
  azure: AzureConfig | null;
  cacheTtlSeconds: number;
  logLevel: string;
}

export function getConfig(): AppConfig {
  const azure = getAzureConfig();
  return {
    azure,
    cacheTtlSeconds: parseCacheTtl(process.env.CACHE_TTL_SECONDS),
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}

function parseCacheTtl(value: string | undefined): number {
  const DEFAULT_TTL = 300;
  if (!value) return DEFAULT_TTL;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL;
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
