export interface AzureConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId?: string;
}

export interface AppConfig {
  azure: AzureConfig;
}

export function getConfig(): AppConfig {
  return {
    azure: getAzureConfig(),
  };
}

function getAzureConfig(): AzureConfig {
  return {
    tenantId: process.env.AZURE_TENANT_ID || '',
    clientId: process.env.AZURE_CLIENT_ID || '',
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
    subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || undefined,
  };
}
