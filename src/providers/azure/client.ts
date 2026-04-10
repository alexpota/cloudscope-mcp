import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import { CostManagementClient } from '@azure/arm-costmanagement';
import { AdvisorManagementClient } from '@azure/arm-advisor';
import { ConsumptionManagementClient } from '@azure/arm-consumption';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import type { AzureConfig } from '../../config.js';
import type {
  CloudCostProvider,
  CostQueryResult,
  ForecastResult,
  Recommendation,
  BudgetInfo,
  IdleResource,
  UntaggedResource,
} from '../types.js';
import {
  AZURE_COST_TYPE,
  AZURE_COST_AGGREGATION_NAME,
  AZURE_COST_AGGREGATION_FUNCTION,
  AZURE_GROUPING_TYPE,
  AZURE_TAG_GROUPING_TYPE,
  AZURE_GRANULARITY_NONE,
  AZURE_GRANULARITY_DAILY,
  AZURE_COST_CATEGORY,
  AZURE_TIMEFRAME_CUSTOM,
  AZURE_CURRENCY_COLUMN,
  AZURE_USAGE_DATE_COLUMN,
  AZURE_COST_STATUS_COLUMN,
  DEFAULT_BUDGET_NAME,
  ADVISOR_CATEGORY_RESOURCE_PREFIXES,
  AZURE_COST_MANAGEMENT_CONCURRENCY,
  AZURE_RETRY_MAX_ATTEMPTS,
  AZURE_RETRY_BASE_DELAY_MS,
  AZURE_RETRY_MAX_DELAY_MS,
  DEFAULT_CACHE_TTL_SECONDS,
  DEFAULT_CURRENCY,
  MAX_CACHE_ENTRIES,
  KQL_UNATTACHED_DISKS,
  KQL_ORPHANED_NICS,
  KQL_UNUSED_PUBLIC_IPS,
  KQL_EMPTY_APP_SERVICE_PLANS,
  KQL_UNTAGGED_RESOURCES,
  IDLE_RESOURCE_REASONS,
  DEFAULT_IDLE_RESOURCE_COST_DAYS,
  COST_STATUS_FORECAST,
  COST_STATUS_ACTUAL,
  GROUP_BY_MAP,
} from '../../constants.js';
import { Cache } from '../../utils/cache.js';
import { createRateLimiter, withRetry, type RateLimiter } from '../../utils/rate-limit.js';
import { isAzureThrottlingError } from './throttling.js';

function requireColumn(columns: Array<{ name?: string }>, name: string): number {
  const idx = columns.findIndex((c) => c.name === name);
  if (idx === -1) {
    throw new Error(
      `Azure response missing column "${name}". Got: ${columns.map((c) => c.name).join(', ')}`,
    );
  }
  return idx;
}

export class AzureCostClient implements CloudCostProvider {
  private costClient: CostManagementClient;
  private advisorClient: AdvisorManagementClient;
  private consumptionClient: ConsumptionManagementClient;
  private resourceGraphClient: ResourceGraphClient;
  private subscriptionId: string;
  private rateLimiter: RateLimiter;
  private queryCache: Cache<CostQueryResult>;
  private forecastCache: Cache<ForecastResult>;
  private recommendationsCache: Cache<Recommendation[]>;
  private budgetsCache: Cache<BudgetInfo[]>;

  constructor(config: AzureConfig & { subscriptionId: string }) {
    this.subscriptionId = config.subscriptionId;

    const credential =
      config.tenantId && config.clientId && config.clientSecret
        ? new ClientSecretCredential(config.tenantId, config.clientId, config.clientSecret)
        : new DefaultAzureCredential();

    this.costClient = new CostManagementClient(credential);
    this.advisorClient = new AdvisorManagementClient(credential, this.subscriptionId);
    this.consumptionClient = new ConsumptionManagementClient(credential, this.subscriptionId);
    this.resourceGraphClient = new ResourceGraphClient(credential);
    this.rateLimiter = createRateLimiter({ concurrency: AZURE_COST_MANAGEMENT_CONCURRENCY });
    this.queryCache = new Cache<CostQueryResult>(DEFAULT_CACHE_TTL_SECONDS, MAX_CACHE_ENTRIES);
    this.forecastCache = new Cache<ForecastResult>(DEFAULT_CACHE_TTL_SECONDS, MAX_CACHE_ENTRIES);
    this.recommendationsCache = new Cache<Recommendation[]>(
      DEFAULT_CACHE_TTL_SECONDS,
      MAX_CACHE_ENTRIES,
    );
    this.budgetsCache = new Cache<BudgetInfo[]>(DEFAULT_CACHE_TTL_SECONDS, MAX_CACHE_ENTRIES);
  }

  private get scope(): string {
    return `/subscriptions/${this.subscriptionId}`;
  }

  /** Serializes concurrent calls and retries on 429 with bounded backoff. */
  private async callAzure<T>(fn: () => Promise<T>): Promise<T> {
    return withRetry(() => this.rateLimiter.run(fn), {
      isRetryable: isAzureThrottlingError,
      maxAttempts: AZURE_RETRY_MAX_ATTEMPTS,
      baseDelayMs: AZURE_RETRY_BASE_DELAY_MS,
      maxDelayMs: AZURE_RETRY_MAX_DELAY_MS,
    });
  }

  async queryCosts(startDate: string, endDate: string, grouping: string): Promise<CostQueryResult> {
    return this.queryCostsForScope(this.scope, startDate, endDate, grouping);
  }

  async queryCostsForScope(
    scope: string,
    startDate: string,
    endDate: string,
    grouping: string,
  ): Promise<CostQueryResult> {
    const key = JSON.stringify({ scope, startDate, endDate, grouping });
    return this.queryCache.getOrFetch(key, async () => {
      const result = await this.callAzure(() =>
        this.costClient.query.usage(scope, {
          type: AZURE_COST_TYPE,
          timeframe: AZURE_TIMEFRAME_CUSTOM,
          timePeriod: {
            from: new Date(startDate),
            to: new Date(endDate),
          },
          dataset: {
            granularity: AZURE_GRANULARITY_NONE,
            aggregation: {
              totalCost: {
                name: AZURE_COST_AGGREGATION_NAME,
                function: AZURE_COST_AGGREGATION_FUNCTION,
              },
            },
            grouping: [{ type: AZURE_GROUPING_TYPE, name: grouping }],
          },
        }),
      );

      const columns = result.columns || [];
      const costIdx = requireColumn(columns, AZURE_COST_AGGREGATION_NAME);
      const nameIdx = requireColumn(columns, grouping);
      const currencyIdx = columns.findIndex((c) => c.name === AZURE_CURRENCY_COLUMN);

      const rows = (result.rows || []).map((row: unknown[]) => ({
        name: String(row[nameIdx]),
        cost: Number(row[costIdx]),
        currency: String(row[currencyIdx] || DEFAULT_CURRENCY),
      }));

      return {
        rows: rows.map((r) => ({ name: r.name, cost: r.cost })),
        currency: rows[0]?.currency || DEFAULT_CURRENCY,
      };
    });
  }

  async queryCostsByTag(startDate: string, endDate: string, tagKey: string): Promise<CostQueryResult> {
    const key = JSON.stringify({ scope: this.scope, startDate, endDate, tagKey, type: 'tag' });
    return this.queryCache.getOrFetch(key, async () => {
      const result = await this.callAzure(() =>
        this.costClient.query.usage(this.scope, {
          type: AZURE_COST_TYPE,
          timeframe: AZURE_TIMEFRAME_CUSTOM,
          timePeriod: {
            from: new Date(startDate),
            to: new Date(endDate),
          },
          dataset: {
            granularity: AZURE_GRANULARITY_NONE,
            aggregation: {
              totalCost: {
                name: AZURE_COST_AGGREGATION_NAME,
                function: AZURE_COST_AGGREGATION_FUNCTION,
              },
            },
            grouping: [{ type: AZURE_TAG_GROUPING_TYPE, name: tagKey }],
          },
        }),
      );

      const columns = result.columns || [];
      const costIdx = requireColumn(columns, AZURE_COST_AGGREGATION_NAME);
      const nameIdx = requireColumn(columns, tagKey);
      const currencyIdx = columns.findIndex((c) => c.name === AZURE_CURRENCY_COLUMN);

      const rows = (result.rows || []).map((row: unknown[]) => ({
        name: String(row[nameIdx]),
        cost: Number(row[costIdx]),
        currency: String(row[currencyIdx] || DEFAULT_CURRENCY),
      }));

      return {
        rows: rows.map((r) => ({ name: r.name, cost: r.cost })),
        currency: rows[0]?.currency || DEFAULT_CURRENCY,
      };
    });
  }

  async forecastCosts(startDate: string, endDate: string): Promise<ForecastResult> {
    const key = JSON.stringify({ startDate, endDate });
    return this.forecastCache.getOrFetch(key, async () => {
      const result = await this.callAzure(() =>
        this.costClient.forecast.usage(this.scope, {
          type: AZURE_COST_TYPE,
          timeframe: AZURE_TIMEFRAME_CUSTOM,
          timePeriod: {
            from: new Date(startDate),
            to: new Date(endDate),
          },
          includeActualCost: true,
          includeFreshPartialCost: false,
          dataset: {
            granularity: AZURE_GRANULARITY_DAILY,
            aggregation: {
              totalCost: {
                name: AZURE_COST_AGGREGATION_NAME,
                function: AZURE_COST_AGGREGATION_FUNCTION,
              },
            },
          },
        }),
      );

      const columns = result.columns || [];
      const costIdx = requireColumn(columns, AZURE_COST_AGGREGATION_NAME);
      const dateIdx = requireColumn(columns, AZURE_USAGE_DATE_COLUMN);
      const typeIdx = requireColumn(columns, AZURE_COST_STATUS_COLUMN);
      const currencyIdx = columns.findIndex((c) => c.name === AZURE_CURRENCY_COLUMN);

      const rows = (result.rows || []).map((row: unknown[]) => ({
        date: String(row[dateIdx]),
        cost: Number(row[costIdx]),
        costType: (String(row[typeIdx]) === COST_STATUS_FORECAST
          ? COST_STATUS_FORECAST
          : COST_STATUS_ACTUAL) as 'Forecast' | 'Actual',
        currency: String(row[currencyIdx] || DEFAULT_CURRENCY),
      }));

      return {
        rows: rows.map((r) => ({ date: r.date, cost: r.cost, costType: r.costType })),
        currency: rows[0]?.currency || DEFAULT_CURRENCY,
      };
    });
  }

  async getRecommendations(category?: string): Promise<Recommendation[]> {
    const key = JSON.stringify({ category: category ?? 'all' });
    return this.recommendationsCache.getOrFetch(key, async () => {
      // Whole iteration wrapped: a 429 mid-pagination retries the full listing.
      return this.callAzure(async () => {
        const recommendations: Recommendation[] = [];

        for await (const rec of this.advisorClient.recommendations.list()) {
          if (rec.category !== AZURE_COST_CATEGORY) continue;
          if (category && category !== 'all') {
            const prefix = ADVISOR_CATEGORY_RESOURCE_PREFIXES[category];
            const field = (rec.impactedField || '').toLowerCase();
            // If impactedField is populated, filter by prefix. If missing,
            // include the recommendation — better to show extra than miss one.
            if (prefix && field && !field.startsWith(prefix)) continue;
          }

          recommendations.push({
            id: rec.id || '',
            category: rec.category || AZURE_COST_CATEGORY,
            impact: rec.impact || 'Unknown',
            description:
              rec.shortDescription?.solution || rec.shortDescription?.problem || 'No description',
            savingsAmount: rec.extendedProperties?.['savingsAmount']
              ? parseFloat(rec.extendedProperties['savingsAmount'])
              : undefined,
            savingsCurrency: rec.extendedProperties?.['savingsCurrency'] || DEFAULT_CURRENCY,
            resourceId: rec.resourceMetadata?.resourceId,
          });
        }

        return recommendations;
      });
    });
  }

  async listBudgets(): Promise<BudgetInfo[]> {
    // No args — a single cache entry per client instance is sufficient.
    return this.budgetsCache.getOrFetch('', async () => {
      return this.callAzure(async () => {
        const budgets: BudgetInfo[] = [];

        for await (const budget of this.consumptionClient.budgets.list(this.scope)) {
          budgets.push({
            name: budget.name || DEFAULT_BUDGET_NAME,
            amount: budget.amount || 0,
            currentSpend: budget.currentSpend?.amount || 0,
            forecastSpend: budget.forecastSpend?.amount || 0,
            currency: budget.currentSpend?.unit || DEFAULT_CURRENCY,
          });
        }

        return budgets;
      });
    });
  }

  async findIdleResources(): Promise<IdleResource[]> {
    const queries = [
      KQL_UNATTACHED_DISKS,
      KQL_ORPHANED_NICS,
      KQL_UNUSED_PUBLIC_IPS,
      KQL_EMPTY_APP_SERVICE_PLANS,
    ];

    const allResources: Array<{ name: string; type: string; resourceGroup: string; id: string }> = [];

    for (const query of queries) {
      const result = await this.callAzure(() =>
        this.resourceGraphClient.resources({
          query,
          subscriptions: [this.subscriptionId],
        }),
      );
      const rows = (result.data as Array<Record<string, string>>) || [];
      for (const row of rows) {
        allResources.push({
          name: row['name'] || '',
          type: row['type'] || '',
          resourceGroup: row['resourceGroup'] || '',
          id: row['id'] || '',
        });
      }
    }

    if (allResources.length === 0) return [];

    // Get cost estimates for idle resources
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - DEFAULT_IDLE_RESOURCE_COST_DAYS);
    const startDate = start.toISOString().split('T')[0] ?? '';
    const endDate = today.toISOString().split('T')[0] ?? '';

    const costMap = new Map<string, { cost: number; currency: string }>();
    try {
      const costResult = await this.queryCosts(startDate, endDate, 'ResourceId');
      for (const row of costResult.rows) {
        costMap.set(row.name.toLowerCase(), { cost: row.cost, currency: costResult.currency });
      }
    } catch {
      // Cost data unavailable — proceed with zero estimates
    }

    return allResources.map((r) => {
      const costEntry = costMap.get(r.id.toLowerCase());
      return {
        name: r.name,
        type: r.type,
        resourceGroup: r.resourceGroup,
        reason: IDLE_RESOURCE_REASONS[r.type] ?? 'Idle resource',
        estimatedMonthlyCost: costEntry?.cost ?? 0,
        currency: costEntry?.currency ?? DEFAULT_CURRENCY,
      };
    });
  }

  async findUntaggedResources(): Promise<UntaggedResource[]> {
    const result = await this.callAzure(() =>
      this.resourceGraphClient.resources({
        query: KQL_UNTAGGED_RESOURCES,
        subscriptions: [this.subscriptionId],
      }),
    );

    const rows = (result.data as Array<Record<string, string>>) || [];
    return rows.map((row) => ({
      name: row['name'] || '',
      type: row['type'] || '',
      resourceGroup: row['resourceGroup'] || '',
      location: row['location'] || '',
    }));
  }

  async validate(): Promise<{ connected: boolean; detail: string }> {
    try {
      const today = new Date().toISOString().split('T')[0] ?? '';
      await this.queryCosts(today, today, GROUP_BY_MAP['service'] ?? 'ServiceName');
      return { connected: true, detail: `subscription: ${this.subscriptionId}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { connected: false, detail: message };
    }
  }
}
