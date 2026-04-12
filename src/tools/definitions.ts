import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SubscriptionInfo } from '../providers/azure/discovery.js';
import type { AzureCostClient } from '../providers/azure/client.js';
import type { GcpProjectInfo } from '../providers/gcp/discovery.js';
import { handleGetCostSummary } from './cost-summary.js';
import { handleDetectAnomalies } from './anomalies.js';
import { handleListRecommendations } from './recommendations.js';
import { handleGetCostForecast } from './forecast.js';
import { handleCheckBudgets } from './budgets.js';
import { handleComparePeriods } from './compare.js';
import { handleTopSpendingResources } from './top-spenders.js';
import { handleGetCurrentDate } from './current-date.js';
import { handleListSubscriptions } from './list-subscriptions.js';
import { handleCrossSubscriptionCosts } from './cross-subscription-costs.js';
import { handleGetCostByTag } from './tag-costs.js';
import { handleFindIdleResources } from './idle-resources.js';
import { handleFindUntaggedResources } from './untagged-resources.js';
import { handleListProjects } from './list-projects.js';
import { handleCrossProjectCosts } from './cross-project-costs.js';
import { toolError, type Providers } from './types.js';
import {
  DEFAULT_ANOMALY_DAYS,
  DEFAULT_ANOMALY_THRESHOLD,
  DEFAULT_FORECAST_DAYS,
  DEFAULT_TOP_RESOURCES_LIMIT,
  DEFAULT_TOP_RESOURCES_DAYS,
} from '../constants.js';

export function registerAllTools(
  server: McpServer,
  providers: Providers,
  defaultProvider: 'azure' | 'gcp',
  azure: { subscriptions: SubscriptionInfo[]; subscriptionId: string; client: AzureCostClient | null },
  gcp: { projects: GcpProjectInfo[]; projectId: string },
): void {
  const providerSchema = z.enum(['azure', 'gcp']).default(defaultProvider).describe('Cloud provider to query (azure or gcp)');

  // --- Shared tools (both providers) ---

  server.registerTool(
    'get_cost_summary',
    {
      title: 'Cloud Cost Summary',
      description:
        'Returns a cost breakdown for a date range grouped by service, resource group, tag, or region. Defaults to current month if dates are omitted. Output includes a sorted table with each group name, cost in USD, and percentage of total. Includes a total row, daily average, and collapses groups beyond the top 10 into an "Other" row. Returns an error if the date range is invalid. Use this when the user asks "how much am I spending", "what costs the most", "show me my cloud bill", or wants a spending overview.',
      inputSchema: {
        provider: providerSchema,
        start_date: z
          .string()
          .optional()
          .describe('Start date (YYYY-MM-DD). Defaults to first of current month.'),
        end_date: z.string().optional().describe('End date (YYYY-MM-DD). Defaults to today.'),
        group_by: z
          .enum(['service', 'resource_group', 'tag', 'region'])
          .default('service')
          .describe('How to group costs: service, resource_group, tag, or region'),
      },
    },
    async (input) => handleGetCostSummary(input, providers),
  );

  server.registerTool(
    'detect_anomalies',
    {
      title: 'Detect Cost Anomalies',
      description:
        'Compares daily spending over the last N days against the prior N days to find cost spikes. Returns a list of services where spending increased above the threshold percentage, sorted by increase amount. Each entry includes service name, previous cost, current cost, percentage change, and absolute change in USD. Returns an empty list if no anomalies found. Use this when the user asks about unexpected cost increases, billing surprises, or wants to know if anything changed recently.',
      inputSchema: {
        provider: providerSchema,
        days: z
          .number()
          .default(DEFAULT_ANOMALY_DAYS)
          .describe('Number of days to compare (default: 7)'),
        threshold: z
          .number()
          .default(DEFAULT_ANOMALY_THRESHOLD)
          .describe('Minimum percentage increase to flag (default: 20)'),
      },
    },
    async (input) => handleDetectAnomalies(input, providers),
  );

  server.registerTool(
    'list_recommendations',
    {
      title: 'Cost Optimization Recommendations',
      description:
        'Fetches cost-saving recommendations filtered by category. Returns a list of recommendations each containing: title, category, impact level (high/medium/low), estimated annual savings in USD, affected resource ID, and a short description of the suggested action. Returns an empty list if no recommendations exist for the selected category. Use this when the user wants to reduce costs, find waste, or optimize resource usage.',
      inputSchema: {
        provider: providerSchema,
        category: z
          .enum(['all', 'compute', 'storage', 'networking'])
          .default('all')
          .describe('Filter by category: all, compute, storage, or networking'),
      },
    },
    async (input) => handleListRecommendations(input, providers),
  );

  server.registerTool(
    'get_cost_forecast',
    {
      title: 'Cost Forecast',
      description:
        'Projects future cloud spending for the next N days using a linear trend based on the last 30 days of actual costs. Returns the forecast period dates, projected total cost in USD, average daily projected cost, and the confidence basis (number of historical days used). Use this when the user asks "how much will I spend this month", wants to predict upcoming bills, or needs to plan budgets. Returns an error if insufficient historical data exists.',
      inputSchema: {
        provider: providerSchema,
        days: z
          .number()
          .default(DEFAULT_FORECAST_DAYS)
          .describe('Number of days to forecast (default: 30)'),
      },
    },
    async (input) => handleGetCostForecast(input, providers),
  );

  server.registerTool(
    'check_budgets',
    {
      title: 'Budget Status',
      description:
        'Check budget status: current spend vs limit, percentage used, forecast, and overage risk. For GCP, requires GCP_BILLING_ACCOUNT_ID to be set.',
      inputSchema: {
        provider: providerSchema,
      },
    },
    async (input) => handleCheckBudgets(input, providers),
  );

  server.registerTool(
    'compare_periods',
    {
      title: 'Compare Cost Periods',
      description:
        'Compare costs between two date ranges, showing per-service absolute and percentage changes.',
      inputSchema: {
        provider: providerSchema,
        period_a_start: z.string().describe('Period A start date (YYYY-MM-DD)'),
        period_a_end: z.string().describe('Period A end date (YYYY-MM-DD)'),
        period_b_start: z.string().describe('Period B start date (YYYY-MM-DD)'),
        period_b_end: z.string().describe('Period B end date (YYYY-MM-DD)'),
        group_by: z
          .enum(['service', 'resource_group'])
          .default('service')
          .describe('How to group costs: service or resource_group'),
      },
    },
    async (input) => handleComparePeriods(input, providers),
  );

  server.registerTool(
    'top_spending_resources',
    {
      title: 'Top Spending Resources',
      description:
        'Find the N most expensive individual resources over a time period. On GCP, requires the detailed billing export for resource-level data.',
      inputSchema: {
        provider: providerSchema,
        days: z
          .number()
          .default(DEFAULT_TOP_RESOURCES_DAYS)
          .describe('Number of days to look back (default: 30)'),
        limit: z
          .number()
          .default(DEFAULT_TOP_RESOURCES_LIMIT)
          .describe('Number of resources to return (default: 10)'),
      },
    },
    async (input) => handleTopSpendingResources(input, providers),
  );

  server.registerTool(
    'get_cost_by_tag',
    {
      title: 'Cost by Tag',
      description:
        'Breaks down costs by a specific tag or label key such as team, environment, or project. Returns a sorted table with each tag value, cost in USD, and percentage of total. Includes a total row and daily average. Returns an error if the date range is invalid or no tagged costs exist. Use this when the user asks about costs per team, per environment, cost allocation, chargeback, or wants to understand spending by any custom tag or label.',
      inputSchema: {
        provider: providerSchema,
        tag_key: z
          .string()
          .describe('Tag/label key to group costs by (e.g. team, environment, project)'),
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
    async (input) => handleGetCostByTag(input, providers),
  );

  server.registerTool(
    'find_idle_resources',
    {
      title: 'Find Idle Resources',
      description:
        'Finds cloud resources that are provisioned but not actively used — unattached disks, orphaned network interfaces, unused IPs, idle VMs, and empty compute plans. Returns each resource with its name, type, resource group/project, reason it is idle, and estimated monthly cost in USD. Returns an empty list if no idle resources are found. Use this when the user asks about waste, idle or unused resources, cleanup opportunities, or wants to find resources to delete to reduce costs.',
      inputSchema: {
        provider: providerSchema,
      },
    },
    async (input) => handleFindIdleResources(input, providers),
  );

  server.registerTool(
    'find_untagged_resources',
    {
      title: 'Find Untagged Resources',
      description:
        'Finds resources that have no tags or labels applied. Returns each resource with its name, type, resource group/project, and location. Untagged resources cannot be attributed to teams or projects, making cost allocation and chargeback impossible. Returns an empty list if all resources are tagged. Use this when the user asks about tagging compliance, governance, cost attribution gaps, or wants to identify resources that need tags or labels.',
      inputSchema: {
        provider: providerSchema,
      },
    },
    async (input) => handleFindUntaggedResources(input, providers),
  );

  // --- Azure-only tools ---

  server.registerTool(
    'get_cross_subscription_costs',
    {
      title: 'Cross-Subscription Cost Summary',
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

  // --- GCP-only tools ---

  server.registerTool(
    'list_projects',
    {
      title: 'List GCP Projects',
      description:
        'Returns all GCP projects the current credential can access, with name, ID, and state. Shows which project is currently active. Use this when the user has multiple GCP projects and wants to see which ones are available, or before calling get_cross_project_costs.',
      inputSchema: {
        provider: z.literal('gcp').describe('Cloud provider (GCP-only tool)'),
      },
    },
    () => {
      if (gcp.projects.length === 0) {
        return toolError(
          new Error('GCP not configured. Set GOOGLE_CLOUD_PROJECT and GCP_BILLING_TABLE.'),
        );
      }
      return handleListProjects(gcp.projects, gcp.projectId);
    },
  );

  server.registerTool(
    'get_cross_project_costs',
    {
      title: 'Cross-Project Cost Summary',
      description:
        'Returns a combined cost breakdown across multiple GCP projects sorted by total spend. Each project shows its name, total cost in USD, and percentage of the combined total. Use this when the user asks about costs across all GCP projects, wants to compare project spending, or needs an organization-wide cost overview.',
      inputSchema: {
        provider: z.literal('gcp').describe('Cloud provider (GCP-only tool)'),
        project_ids: z
          .array(z.string())
          .optional()
          .describe('Project IDs to include. Defaults to all known projects.'),
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
    async (input) => handleCrossProjectCosts(input, providers, gcp.projects),
  );

  // --- Utility tools ---

  server.registerTool(
    'get_current_date',
    {
      title: 'Current Date',
      description:
        "Returns today's date and the start/end of current and previous months in YYYY-MM-DD format",
      inputSchema: {},
    },
    () => {
      return handleGetCurrentDate();
    },
  );
}
