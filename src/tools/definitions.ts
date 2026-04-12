import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SubscriptionInfo } from '../providers/azure/discovery.js';
import type { AzureCostClient } from '../providers/azure/client.js';
import type { GcpProjectInfo } from '../providers/gcp/discovery.js';
import { registerSharedTools } from './register-shared.js';
import { registerAzureTools } from './register-azure.js';
import { registerGcpTools } from './register-gcp.js';
import type { Providers } from './types.js';

export function registerAllTools(
  server: McpServer,
  providers: Providers,
  defaultProvider: 'azure' | 'gcp',
  azure: { subscriptions: SubscriptionInfo[]; subscriptionId: string; client: AzureCostClient | null },
  gcp: { projects: GcpProjectInfo[]; projectId: string },
): void {
  registerSharedTools(server, providers, defaultProvider);
  registerAzureTools(server, azure);
  registerGcpTools(server, providers, gcp);
}
