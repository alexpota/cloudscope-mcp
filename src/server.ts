import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getConfig } from './config.js';
import { AzureCostClient } from './providers/azure/client.js';
import { Cache } from './utils/cache.js';
import { handleGetCostSummary } from './tools/cost-summary.js';
import { handleDetectAnomalies } from './tools/anomalies.js';
import { handleListRecommendations } from './tools/recommendations.js';
import { handleGetCostForecast } from './tools/forecast.js';
import { handleCheckBudgets } from './tools/budgets.js';
import { handleComparePeriods } from './tools/compare.js';
import { handleTopSpendingResources } from './tools/top-spenders.js';
import { handleGetCurrentDate } from './tools/current-date.js';
import type { ToolResult, Providers } from './tools/types.js';
import {
  PACKAGE_NAME,
  PACKAGE_VERSION,
  DEFAULT_ANOMALY_DAYS,
  DEFAULT_ANOMALY_THRESHOLD,
  DEFAULT_FORECAST_DAYS,
  DEFAULT_TOP_RESOURCES_LIMIT,
  DEFAULT_TOP_RESOURCES_DAYS,
  MAX_CACHE_ENTRIES,
} from './constants.js';

export function createServer(): McpServer {
  const config = getConfig();

  const providers: Providers = {
    azure: config.azure ? new AzureCostClient(config.azure) : null,
  };

  const cache = new Cache<ToolResult>(config.cacheTtlSeconds, MAX_CACHE_ENTRIES);

  const server = new McpServer({
    name: PACKAGE_NAME,
    version: PACKAGE_VERSION,
  });

  server.registerTool(
    'get_cost_summary',
    {
      title: 'Cloud Cost Summary',
      description:
        'Get cloud spending breakdown by service, resource group, or region for a date range. Defaults to current month if dates omitted.',
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
    async (input) => {
      const cacheKey = `cost_summary:${JSON.stringify(input)}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const result = await handleGetCostSummary(input, providers);
      if (!result.isError) cache.set(cacheKey, result);
      return result;
    },
  );

  server.registerTool(
    'detect_anomalies',
    {
      title: 'Detect Cost Anomalies',
      description: 'Find spending spikes by comparing the last N days to the N days before that',
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
    async (input) => {
      const cacheKey = `anomalies:${JSON.stringify(input)}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const result = await handleDetectAnomalies(input, providers);
      if (!result.isError) cache.set(cacheKey, result);
      return result;
    },
  );

  server.registerTool(
    'list_recommendations',
    {
      title: 'Cost Optimization Recommendations',
      description: 'Get cost-saving recommendations from Azure Advisor',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
        category: z
          .enum(['all', 'compute', 'storage', 'networking'])
          .default('all')
          .describe('Filter by category: all, compute, storage, or networking'),
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

  server.registerTool(
    'get_cost_forecast',
    {
      title: 'Cost Forecast',
      description: 'Predict cloud spending for the next N days based on current trends',
      inputSchema: {
        provider: z.literal('azure').describe('Cloud provider to query'),
        days: z
          .number()
          .default(DEFAULT_FORECAST_DAYS)
          .describe('Number of days to forecast (default: 30)'),
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
    async (input) => {
      const cacheKey = `budgets:${JSON.stringify(input)}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const result = await handleCheckBudgets(input, providers);
      if (!result.isError) cache.set(cacheKey, result);
      return result;
    },
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
    async (input) => {
      const cacheKey = `compare:${JSON.stringify(input)}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const result = await handleComparePeriods(input, providers);
      if (!result.isError) cache.set(cacheKey, result);
      return result;
    },
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
    async (input) => {
      const cacheKey = `top_spenders:${JSON.stringify(input)}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const result = await handleTopSpendingResources(input, providers);
      if (!result.isError) cache.set(cacheKey, result);
      return result;
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

  return server;
}
