export class ProviderError extends Error {
  constructor(
    public provider: 'azure' | 'gcp',
    message: string,
    public override cause?: unknown,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderError';
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: 'azure' | 'gcp') {
    super(
      `${provider.toUpperCase()} is not configured. ` +
        (provider === 'azure'
          ? 'Set AZURE_SUBSCRIPTION_ID (and optionally AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET) environment variables.'
          : 'Set GCP_PROJECT_ID and GCP_BILLING_TABLE environment variables.'),
    );
    this.name = 'ProviderNotConfiguredError';
  }
}
