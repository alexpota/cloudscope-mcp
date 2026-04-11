export interface AzureConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId?: string;
}

export interface GcpConfig {
  projectId: string;
  billingTable: string;
  billingAccountId?: string;
}

export interface AppConfig {
  azure: AzureConfig;
  gcp: GcpConfig;
}

export function getConfig(): AppConfig {
  return {
    azure: getAzureConfig(),
    gcp: getGcpConfig(),
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

function getGcpConfig(): GcpConfig {
  return {
    projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '',
    billingTable: process.env.GCP_BILLING_TABLE || '',
    billingAccountId: process.env.GCP_BILLING_ACCOUNT_ID || undefined,
  };
}
