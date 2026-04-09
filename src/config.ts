export interface AzureConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
}

export interface AppConfig {
  azure: AzureConfig | null;
}

export function getConfig(): AppConfig {
  return {
    azure: getAzureConfig(),
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
