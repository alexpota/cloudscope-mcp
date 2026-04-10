import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getConfig } from './config.js';
import { initializeAzureProvider } from './providers/azure/discovery.js';
import type { SubscriptionInfo } from './providers/azure/discovery.js';
import { handleGetCostSummary } from './tools/cost-summary.js';
import { handleDetectAnomalies } from './tools/anomalies.js';
import { handleListRecommendations } from './tools/recommendations.js';
import { handleGetCostForecast } from './tools/forecast.js';
import { handleCheckBudgets } from './tools/budgets.js';
import { handleComparePeriods } from './tools/compare.js';
import { handleTopSpendingResources } from './tools/top-spenders.js';
import { handleGetCurrentDate } from './tools/current-date.js';
import { handleListSubscriptions } from './tools/list-subscriptions.js';
import { handleCrossSubscriptionCosts } from './tools/cross-subscription-costs.js';
import { registerPrompts } from './prompts/index.js';
import type { Providers } from './tools/types.js';
import { toolError } from './tools/types.js';
import {
  PACKAGE_NAME,
  PACKAGE_VERSION,
  DEFAULT_ANOMALY_DAYS,
  DEFAULT_ANOMALY_THRESHOLD,
  DEFAULT_FORECAST_DAYS,
  DEFAULT_TOP_RESOURCES_LIMIT,
  DEFAULT_TOP_RESOURCES_DAYS,
} from './constants.js';

export async function createServer(): Promise<McpServer> {
  const config = getConfig();

  const azureResult = await initializeAzureProvider(config.azure);
  const providers: Providers = { azure: azureResult?.client ?? null };
  const azureSubscriptions: SubscriptionInfo[] = azureResult?.subscriptions ?? [];
  const activeSubscriptionId: string = azureResult?.subscriptionId ?? '';

  if (azureResult && config.azure.subscriptionId) {
    console.error(`${PACKAGE_NAME} v${PACKAGE_VERSION} | Azure: configured`);
  }

  const server = new McpServer(
    { name: PACKAGE_NAME, version: PACKAGE_VERSION },
    {
      instructions:
        'CloudScope provides read-only access to Azure cost data. ' +
        'Call get_current_date before any date-dependent tool if the current date is unclear — LLMs frequently hallucinate dates. ' +
        'For investigating cost increases, combine detect_anomalies with top_spending_resources to identify both the service and the specific resource. ' +
        'list_recommendations returns Azure Advisor suggestions — pair with check_budgets to prioritize savings for at-risk budgets. ' +
        'All costs are in USD. All dates use YYYY-MM-DD format.',
    },
  );

  server.registerTool(
    'get_cost_summary',
    {
      title: 'Cloud Cost Summary',
      description:
        'Returns a cost breakdown for a date range grouped by service, resource group, tag, or region. Defaults to current month if dates are omitted. Output includes a sorted table with each group name, cost in USD, and percentage of total. Includes a total row, daily average, and collapses groups beyond the top 10 into an "Other" row. Returns an error if the date range is invalid. Use this when the user asks "how much am I spending", "what costs the most", "show me my Azure bill", or wants a spending overview.',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
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
        'Compares daily spending over the last N days against the prior N days to find cost spikes. Returns a list of services where spending increased above the threshold percentage, sorted by increase amount. Each entry includes service name, previous average, current average, percentage change, and absolute change in USD. Returns an empty list if no anomalies found. Use this when the user asks about unexpected cost increases, billing surprises, or wants to know if anything changed recently.',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
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
        'Fetches cost-saving recommendations from Azure Advisor filtered by category. Returns a list of recommendations each containing: title, category, impact level (high/medium/low), estimated annual savings in USD, affected resource ID, and a short description of the suggested action. Returns an empty list if no recommendations exist for the selected category. Use this when the user wants to reduce costs, find waste, or optimize resource usage.',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
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
        provider: z.literal('azure').describe('Cloud provider to query'),
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
        'Check Azure budget status: current spend vs limit, percentage used, forecast, and overage risk',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
      },
    },
    async (input) => handleCheckBudgets(input, providers),
  );

  server.registerTool(
    'compare_periods',
    {
      title: 'Compare Cost Periods',
      description:
        'Compare costs between two date ranges, showing per-service absolute and percentage changes',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
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
      description: 'Find the N most expensive individual Azure resources over a time period',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
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
    'get_cross_subscription_costs',
    {
      title: 'Cross-Subscription Cost Summary',
      description:
        'Returns a combined cost breakdown across multiple Azure subscriptions sorted by total spend. Each subscription shows its name, total cost in USD, and percentage of the combined total. Handles partial failures gracefully — if some subscriptions are inaccessible, returns results for the rest with a warning. Use this when the user asks about costs across all subscriptions, wants to compare subscription spending, or needs an organization-wide cost overview.',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
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
      if (!azureResult?.client) {
        return toolError(new Error('Azure not configured. Run az login or set AZURE_SUBSCRIPTION_ID.'));
      }
      return handleCrossSubscriptionCosts(
        input,
        {
          queryCostsForScope: (scope, start, end, grouping) =>
            azureResult.client.queryCostsForScope(scope, start, end, grouping),
        },
        azureSubscriptions,
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
        provider: z.literal('azure').describe('Cloud provider to query'),
      },
    },
    () => {
      if (azureSubscriptions.length === 0) {
        return toolError(new Error('Azure not configured. Run az login or set AZURE_SUBSCRIPTION_ID.'));
      }
      return handleListSubscriptions(azureSubscriptions, activeSubscriptionId);
    },
  );

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

  registerPrompts(server);

  return server;
}
