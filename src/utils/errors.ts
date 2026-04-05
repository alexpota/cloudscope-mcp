export class ProviderNotConfiguredError extends Error {
  constructor() {
    super(
      'Azure is not configured. Set AZURE_SUBSCRIPTION_ID (and optionally AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET) environment variables.',
    );
    this.name = 'ProviderNotConfiguredError';
  }
}
