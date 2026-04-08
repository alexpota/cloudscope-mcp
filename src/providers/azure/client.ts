import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import { CostManagementClient } from '@azure/arm-costmanagement';
import { AdvisorManagementClient } from '@azure/arm-advisor';
import { ConsumptionManagementClient } from '@azure/arm-consumption';
import type { AzureConfig } from '../../config.js';
import type {
  CloudCostProvider,
  CostQueryResult,
  ForecastResult,
  Recommendation,
  BudgetInfo,
} from '../types.js';
import {
  AZURE_COST_TYPE,
  AZURE_COST_AGGREGATION_NAME,
  AZURE_COST_AGGREGATION_FUNCTION,
  AZURE_GROUPING_TYPE,
  AZURE_GRANULARITY_NONE,
  AZURE_GRANULARITY_DAILY,
  AZURE_COST_CATEGORY,
  AZURE_COST_MANAGEMENT_CONCURRENCY,
  AZURE_RETRY_MAX_ATTEMPTS,
  AZURE_RETRY_BASE_DELAY_MS,
  AZURE_RETRY_MAX_DELAY_MS,
  DEFAULT_CURRENCY,
  COST_STATUS_FORECAST,
  COST_STATUS_ACTUAL,
} from '../../constants.js';
import { createRateLimiter, withRetry, type RateLimiter } from '../../utils/rate-limit.js';
import { isAzureThrottlingError } from './throttling.js';

export class AzureCostClient implements CloudCostProvider {
  private costClient: CostManagementClient;
  private advisorClient: AdvisorManagementClient;
  private consumptionClient: ConsumptionManagementClient;
  private subscriptionId: string;
  private rateLimiter: RateLimiter;

  constructor(config: AzureConfig) {
    this.subscriptionId = config.subscriptionId;

    const credential =
      config.tenantId && config.clientId && config.clientSecret
        ? new ClientSecretCredential(config.tenantId, config.clientId, config.clientSecret)
        : new DefaultAzureCredential();

    this.costClient = new CostManagementClient(credential);
    this.advisorClient = new AdvisorManagementClient(credential, this.subscriptionId);
    this.consumptionClient = new ConsumptionManagementClient(credential, this.subscriptionId);
    this.rateLimiter = createRateLimiter({ concurrency: AZURE_COST_MANAGEMENT_CONCURRENCY });
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
    const result = await this.callAzure(() =>
      this.costClient.query.usage(this.scope, {
        type: AZURE_COST_TYPE,
        timeframe: 'Custom',
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
    const costIdx = columns.findIndex((c) => c.name === AZURE_COST_AGGREGATION_NAME);
    const nameIdx = columns.findIndex((c) => c.name === grouping);
    const currencyIdx = columns.findIndex((c) => c.name === 'Currency');

    const rows = (result.rows || []).map((row: unknown[]) => ({
      name: String(row[nameIdx]),
      cost: Number(row[costIdx]),
      currency: String(row[currencyIdx] || DEFAULT_CURRENCY),
    }));

    return {
      rows: rows.map((r) => ({ name: r.name, cost: r.cost })),
      currency: rows[0]?.currency || DEFAULT_CURRENCY,
    };
  }

  async forecastCosts(startDate: string, endDate: string): Promise<ForecastResult> {
    const result = await this.callAzure(() =>
      this.costClient.forecast.usage(this.scope, {
        type: AZURE_COST_TYPE,
        timeframe: 'Custom',
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
    const costIdx = columns.findIndex((c) => c.name === AZURE_COST_AGGREGATION_NAME);
    const dateIdx = columns.findIndex((c) => c.name === 'UsageDate');
    const typeIdx = columns.findIndex((c) => c.name === 'CostStatus');
    const currencyIdx = columns.findIndex((c) => c.name === 'Currency');

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
  }

  async getRecommendations(category?: string): Promise<Recommendation[]> {
    // Whole iteration wrapped: a 429 mid-pagination retries the full listing.
    return this.callAzure(async () => {
      const recommendations: Recommendation[] = [];

      for await (const rec of this.advisorClient.recommendations.list()) {
        if (rec.category !== AZURE_COST_CATEGORY) continue;
        if (category && category !== 'all') {
          const desc = (rec.shortDescription?.solution || '').toLowerCase();
          if (!desc.includes(category)) continue;
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
  }

  async listBudgets(): Promise<BudgetInfo[]> {
    return this.callAzure(async () => {
      const budgets: BudgetInfo[] = [];

      for await (const budget of this.consumptionClient.budgets.list(this.scope)) {
        budgets.push({
          name: budget.name || 'Unnamed',
          amount: budget.amount || 0,
          currentSpend: budget.currentSpend?.amount || 0,
          forecastSpend: budget.forecastSpend?.amount || 0,
          currency: budget.currentSpend?.unit || DEFAULT_CURRENCY,
        });
      }

      return budgets;
    });
  }

  async validate(): Promise<{ connected: boolean; detail: string }> {
    try {
      await this.listBudgets();
      return { connected: true, detail: `subscription: ${this.subscriptionId}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { connected: false, detail: message };
    }
  }
}
