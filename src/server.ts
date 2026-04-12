import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfig } from './config.js';
import { initializeAzureProvider } from './providers/azure/discovery.js';
import { initializeGcpProvider } from './providers/gcp/discovery.js';
import { registerAllTools } from './tools/definitions.js';
import { registerPrompts } from './prompts/index.js';
import type { Providers } from './tools/types.js';
import { PACKAGE_NAME, PACKAGE_VERSION } from './constants.js';

function buildInstructions(
  hasAzure: boolean,
  hasGcp: boolean,
  defaultProvider: 'azure' | 'gcp',
  subscriptionId: string,
  projectId: string,
): string {
  const parts: string[] = [];

  if (hasAzure && hasGcp) {
    parts.push(
      `CloudScope is connected to Azure (subscription: ${subscriptionId}) and GCP (project: ${projectId}). ` +
        `The default provider is ${defaultProvider}. To query the other provider, pass provider: '${defaultProvider === 'azure' ? 'gcp' : 'azure'}' explicitly.`,
    );
  } else if (hasAzure) {
    parts.push(`CloudScope is connected to Azure (subscription: ${subscriptionId}). GCP is not configured.`);
  } else if (hasGcp) {
    parts.push(`CloudScope is connected to GCP (project: ${projectId}). Azure is not configured.`);
  } else {
    parts.push('CloudScope has no providers configured. Set Azure or GCP environment variables to enable cost queries.');
  }

  parts.push(
    'Call get_current_date before any date-dependent tool if the current date is unclear — LLMs frequently hallucinate dates.',
    'For investigating cost increases, combine detect_anomalies with top_spending_resources to identify both the service and the specific resource.',
    'list_recommendations returns cost optimization suggestions — pair with check_budgets to prioritize savings for at-risk budgets.',
    'find_idle_resources detects provisioned-but-unused resources with cost estimates.',
  );

  if (hasAzure) {
    parts.push('For Azure cross-subscription queries, call list_subscriptions first, then get_cross_subscription_costs.');
  }
  if (hasGcp) {
    parts.push('For GCP cross-project queries, call list_projects first, then get_cross_project_costs.');
  }

  parts.push(
    'get_cost_by_tag groups spending by any tag key (Azure tags or GCP labels) — useful for chargeback and cost allocation.',
    'find_untagged_resources identifies resources missing tags/labels, which creates cost attribution gaps.',
    'All costs are in USD. All dates use YYYY-MM-DD format.',
  );

  return parts.join(' ');
}

export async function createServer(): Promise<McpServer> {
  const config = getConfig();

  const azureResult = await initializeAzureProvider(config.azure);
  const gcpResult = await initializeGcpProvider(config.gcp);

  const providers: Providers = {
    azure: azureResult?.client ?? null,
    gcp: gcpResult?.client ?? null,
  };

  const hasAzure = providers.azure !== null;
  const hasGcp = providers.gcp !== null;
  const defaultProvider: 'azure' | 'gcp' = hasGcp && !hasAzure ? 'gcp' : 'azure';

  if (azureResult && config.azure.subscriptionId) {
    console.error(`${PACKAGE_NAME} v${PACKAGE_VERSION} | Azure: configured`);
  }

  const server = new McpServer(
    { name: PACKAGE_NAME, version: PACKAGE_VERSION },
    { instructions: buildInstructions(hasAzure, hasGcp, defaultProvider, azureResult?.subscriptionId ?? '', gcpResult?.projectId ?? '') },
  );

  registerAllTools(server, providers, defaultProvider, {
    subscriptions: azureResult?.subscriptions ?? [],
    subscriptionId: azureResult?.subscriptionId ?? '',
    client: azureResult?.client ?? null,
  }, {
    projects: gcpResult?.projects ?? [],
    projectId: gcpResult?.projectId ?? '',
  });

  registerPrompts(server);

  return server;
}
