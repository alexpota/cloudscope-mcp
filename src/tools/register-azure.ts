import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SubscriptionInfo } from '../providers/azure/discovery.js';
import type { AzureCostClient } from '../providers/azure/client.js';
import { handleListSubscriptions } from './list-subscriptions.js';
import { handleCrossSubscriptionCosts } from './cross-subscription-costs.js';
import { toolError } from './types.js';
import { TOOL_ANNOTATIONS_READ_ONLY } from '../constants.js';

export function registerAzureTools(
  server: McpServer,
  azure: { subscriptions: SubscriptionInfo[]; subscriptionId: string; client: AzureCostClient | null },
): void {
  server.registerTool(
    'get_cross_subscription_costs',
    {
      title: 'Cross-Subscription Cost Summary',
      annotations: TOOL_ANNOTATIONS_READ_ONLY,
      description:
        'Returns a combined cost breakdown across multiple Azure subscriptions sorted by total spend. Each subscription shows its name, total cost in USD, and percentage of the combined total. Handles partial failures gracefully — if some subscriptions are inaccessible, returns results for the rest with a warning. Use this when the user asks about costs across all subscriptions, wants to compare subscription spending, or needs an organization-wide cost overview.',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider (Azure-only tool)'),
        subscription_ids: z
          .array(z.string())
          .optional()
          .describe('Subscription IDs to include. Defaults to all enabled subscriptions.'),
        start_date: z
          .string()
          .optional()
          .describe('Start date (YYYY-MM-DD). Defaults to first of current month.'),
        end_date: z
          .string()
          .optional()
          .describe('End date (YYYY-MM-DD). Defaults to today.'),
      },
    },
    async (input) => {
      const azureClient = azure.client;
      if (!azureClient) {
        return toolError(new Error('Azure not configured. Run az login or set AZURE_SUBSCRIPTION_ID.'));
      }
      return handleCrossSubscriptionCosts(
        input,
        {
          queryCostsForScope: (scope, start, end, grouping) =>
            azureClient.queryCostsForScope(scope, start, end, grouping),
        },
        azure.subscriptions,
      );
    },
  );

  server.registerTool(
    'list_subscriptions',
    {
      title: 'List Azure Subscriptions',
      annotations: TOOL_ANNOTATIONS_READ_ONLY,
      description:
        'Returns all Azure subscriptions the current credential can access, with name, ID, and state. Shows which subscription is currently active. Use this when the user has multiple subscriptions and wants to see which ones are available, or to confirm which subscription is being queried.',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider (Azure-only tool)'),
      },
    },
    () => {
      if (azure.subscriptions.length === 0) {
        return toolError(new Error('Azure not configured. Run az login or set AZURE_SUBSCRIPTION_ID.'));
      }
      return handleListSubscriptions(azure.subscriptions, azure.subscriptionId);
    },
  );
}
