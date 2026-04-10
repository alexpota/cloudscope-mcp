import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import type { TokenCredential } from '@azure/core-auth';
import { SubscriptionClient } from '@azure/arm-resources-subscriptions';
import type { AzureConfig } from '../../config.js';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../constants.js';
import { AzureCostClient } from './client.js';

export interface SubscriptionInfo {
  id: string;
  name: string;
  state: string;
}

export interface AzureProviderResult {
  client: AzureCostClient;
  credential: TokenCredential;
  subscriptionId: string;
  subscriptions: SubscriptionInfo[];
}

export function createAzureCredential(config: AzureConfig): TokenCredential {
  return config.tenantId && config.clientId && config.clientSecret
    ? new ClientSecretCredential(config.tenantId, config.clientId, config.clientSecret)
    : new DefaultAzureCredential();
}

export async function listAzureSubscriptions(
  credential: TokenCredential,
): Promise<SubscriptionInfo[]> {
  const client = new SubscriptionClient(credential);
  const subs: SubscriptionInfo[] = [];
  for await (const sub of client.subscriptions.list()) {
    subs.push({
      id: sub.subscriptionId || '',
      name: sub.displayName || '',
      state: sub.state || 'Unknown',
    });
  }
  return subs;
}

export async function discoverSubscriptionId(
  credential: TokenCredential,
): Promise<string> {
  const subs = await listAzureSubscriptions(credential);
  const enabled = subs.filter((s) => s.state === 'Enabled');
  const first = enabled[0];
  if (!first) {
    throw new Error('No enabled Azure subscriptions found. Set AZURE_SUBSCRIPTION_ID manually.');
  }
  return first.id;
}

/**
 * Initializes the Azure provider. Handles three paths:
 * 1. AZURE_SUBSCRIPTION_ID set → use it directly
 * 2. Not set → auto-discover via credential (az login / managed identity)
 * 3. Auto-discovery fails → return null (tools show "not configured")
 */
export async function initializeAzureProvider(
  config: AzureConfig,
): Promise<AzureProviderResult | null> {
  const credential = createAzureCredential(config);

  let subscriptionId = config.subscriptionId;
  let subscriptions: SubscriptionInfo[];

  if (subscriptionId) {
    try {
      subscriptions = [...(await listAzureSubscriptions(credential))];
    } catch {
      subscriptions = [{ id: subscriptionId, name: subscriptionId, state: 'Enabled' }];
    }
  } else {
    // Auto-discovery path
    try {
      subscriptions = await listAzureSubscriptions(credential);
      const enabled = subscriptions.filter((s) => s.state === 'Enabled');
      if (enabled.length === 0) {
        console.error(`${PACKAGE_NAME} v${PACKAGE_VERSION} | Azure: no enabled subscriptions found`);
        return null;
      }
      const first = enabled[0];
      if (!first) return null;
      subscriptionId = first.id;
      console.error(
        `${PACKAGE_NAME} v${PACKAGE_VERSION} | Azure: auto-discovered subscription "${first.name}" (${subscriptionId})`,
      );
      if (enabled.length > 1) {
        console.error(
          `  ${enabled.length} subscriptions available. Set AZURE_SUBSCRIPTION_ID to override.`,
        );
      }
    } catch {
      console.error(
        `${PACKAGE_NAME} v${PACKAGE_VERSION} | Azure: not configured (set AZURE_SUBSCRIPTION_ID or run az login)`,
      );
      return null;
    }
  }

  if (!subscriptionId) return null;

  const client = new AzureCostClient({
    ...config,
    subscriptionId,
  });

  return { client, credential, subscriptionId, subscriptions };
}
