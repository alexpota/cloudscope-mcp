import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getConfig } from './config.js';
import { AzureCostClient } from './providers/azure/client.js';
import { Cache } from './utils/cache.js';
import { handleGetCostSummary, type Providers } from './tools/cost-summary.js';
import { handleDetectAnomalies } from './tools/anomalies.js';
import { handleListRecommendations } from './tools/recommendations.js';
import { handleGetCostForecast } from './tools/forecast.js';
import { handleCheckBudgets } from './tools/budgets.js';
import { handleComparePeriods } from './tools/compare.js';
import { handleTopSpendingResources } from './tools/top-spenders.js';
import { handleGetCurrentDate } from './tools/current-date.js';
import type { ToolResult } from './tools/types.js';

export function createServer(): McpServer {
  const config = getConfig();

  const providers: Providers = {
    azure: config.azure ? new AzureCostClient(config.azure) : null,
  };

  const cache = new Cache<ToolResult>(config.cacheTtlSeconds);

  const server = new McpServer({
    name: 'cloudscope-mcp',
    version: '0.1.0',
  });

  // Tool 1: get_cost_summary
  server.registerTool(
    'get_cost_summary',
    {
      title: 'Cloud Cost Summary',
      description:
        'Get cloud spending breakdown by service, resource group, or tag for any date range',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        group_by: z
          .enum(['service', 'resource_group', 'tag', 'region'])
          .default('service')
          .describe('How to group costs'),
      },
    },
    async (input) => {
      const cacheKey = `cost_summary:${JSON.stringify(input)}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const result = await handleGetCostSummary(input, providers);
      if (!result.isError) cache.set(cacheKey, result);
      return result;
    },
  );

  // Tool 2: detect_anomalies
  server.registerTool(
    'detect_anomalies',
    {
      title: 'Detect Cost Anomalies',
      description: 'Find spending spikes by comparing current period to previous period',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
        days: z.number().default(7).describe('Compare last N days to N days before that'),
        threshold: z.number().default(20).describe('Percentage increase to flag as anomaly'),
      },
    },
    async (input) => {
      const cacheKey = `anomalies:${JSON.stringify(input)}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const result = await handleDetectAnomalies(input, providers);
      if (!result.isError) cache.set(cacheKey, result);
      return result;
    },
  );

  // Tool 3: list_recommendations
  server.registerTool(
    'list_recommendations',
    {
      title: 'Cost Optimization Recommendations',
      description: 'Get cost optimization recommendations from the cloud provider',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
        category: z
          .enum(['all', 'compute', 'storage', 'networking'])
          .default('all')
          .describe('Filter recommendations by category'),
      },
    },
    async (input) => {
      const cacheKey = `recommendations:${JSON.stringify(input)}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const result = await handleListRecommendations(input, providers);
      if (!result.isError) cache.set(cacheKey, result);
      return result;
    },
  );

  // Tool 4: get_cost_forecast
  server.registerTool(
    'get_cost_forecast',
    {
      title: 'Cost Forecast',
      description: 'Predict cloud spending for the next N days using the forecast API',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
        days: z.number().default(30).describe('Number of days to forecast'),
      },
    },
    async (input) => {
      const cacheKey = `forecast:${JSON.stringify(input)}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const result = await handleGetCostForecast(input, providers);
      if (!result.isError) cache.set(cacheKey, result);
      return result;
    },
  );

  // Tool 5: check_budgets
  server.registerTool(
    'check_budgets',
    {
      title: 'Budget Status',
      description: 'Check budget status with current spend, limit, and projected overage',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
      },
    },
    async (input) => {
      const cacheKey = `budgets:${JSON.stringify(input)}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const result = await handleCheckBudgets(input, providers);
      if (!result.isError) cache.set(cacheKey, result);
      return result;
    },
  );

  // Tool 6: compare_periods
  server.registerTool(
    'compare_periods',
    {
      title: 'Compare Cost Periods',
      description: 'Compare costs between two time periods with absolute and percentage changes',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
        period_a_start: z.string().describe('Period A start date (YYYY-MM-DD)'),
        period_a_end: z.string().describe('Period A end date (YYYY-MM-DD)'),
        period_b_start: z.string().describe('Period B start date (YYYY-MM-DD)'),
        period_b_end: z.string().describe('Period B end date (YYYY-MM-DD)'),
        group_by: z
          .enum(['service', 'resource_group'])
          .default('service')
          .describe('How to group costs'),
      },
    },
    async (input) => {
      const cacheKey = `compare:${JSON.stringify(input)}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const result = await handleComparePeriods(input, providers);
      if (!result.isError) cache.set(cacheKey, result);
      return result;
    },
  );

  // Tool 7: top_spending_resources
  server.registerTool(
    'top_spending_resources',
    {
      title: 'Top Spending Resources',
      description: 'Find the most expensive individual resources',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
        days: z.number().default(30).describe('Number of days to look back'),
        limit: z.number().default(10).describe('Number of resources to return'),
      },
    },
    async (input) => {
      const cacheKey = `top_spenders:${JSON.stringify(input)}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const result = await handleTopSpendingResources(input, providers);
      if (!result.isError) cache.set(cacheKey, result);
      return result;
    },
  );

  // Tool 8: get_current_date
  server.registerTool(
    'get_current_date',
    {
      title: 'Current Date',
      description:
        "Get today's date and current/previous month boundaries for accurate date parameters",
      inputSchema: {},
    },
    () => {
      return handleGetCurrentDate();
    },
  );

  return server;
}
