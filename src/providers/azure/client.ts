import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import { CostManagementClient } from '@azure/arm-costmanagement';
import { AdvisorManagementClient } from '@azure/arm-advisor';
import { ConsumptionManagementClient } from '@azure/arm-consumption';
import type { AzureConfig } from '../../config.js';
import type {
  AzureBudget,
  AzureCostResult,
  AzureCostRow,
  AzureForecastResult,
  AzureForecastRow,
  AzureRecommendation,
  CostGrouping,
} from './types.js';

export class AzureCostClient {
  private costClient: CostManagementClient;
  private advisorClient: AdvisorManagementClient;
  private consumptionClient: ConsumptionManagementClient;
  private subscriptionId: string;

  constructor(config: AzureConfig) {
    this.subscriptionId = config.subscriptionId;

    const credential =
      config.tenantId && config.clientId && config.clientSecret
        ? new ClientSecretCredential(config.tenantId, config.clientId, config.clientSecret)
        : new DefaultAzureCredential();

    this.costClient = new CostManagementClient(credential);
    this.advisorClient = new AdvisorManagementClient(credential, this.subscriptionId);
    this.consumptionClient = new ConsumptionManagementClient(credential, this.subscriptionId);
  }

  get scope(): string {
    return `/subscriptions/${this.subscriptionId}`;
  }

  async queryCosts(
    startDate: string,
    endDate: string,
    grouping: CostGrouping,
  ): Promise<AzureCostResult> {
    const result = await this.costClient.query.usage(this.scope, {
      type: 'ActualCost',
      timeframe: 'Custom',
      timePeriod: {
        from: new Date(startDate),
        to: new Date(endDate),
      },
      dataset: {
        granularity: 'None',
        aggregation: {
          totalCost: { name: 'Cost', function: 'Sum' },
        },
        grouping: [{ type: 'Dimension', name: grouping }],
      },
    });

    const columns = result.columns || [];
    const costIdx = columns.findIndex((c) => c.name === 'Cost');
    const nameIdx = columns.findIndex((c) => c.name === grouping);
    const currencyIdx = columns.findIndex((c) => c.name === 'Currency');

    const rows: AzureCostRow[] = (result.rows || []).map((row: unknown[]) => ({
      serviceName: String(row[nameIdx]),
      cost: Number(row[costIdx]),
      currency: String(row[currencyIdx] || 'USD'),
    }));

    return {
      rows,
      currency: rows[0]?.currency || 'USD',
    };
  }

  async forecastCosts(startDate: string, endDate: string): Promise<AzureForecastResult> {
    const result = await this.costClient.forecast.usage(this.scope, {
      type: 'ActualCost',
      timeframe: 'Custom',
      timePeriod: {
        from: new Date(startDate),
        to: new Date(endDate),
      },
      includeActualCost: true,
      includeFreshPartialCost: false,
      dataset: {
        granularity: 'Daily',
        aggregation: {
          totalCost: { name: 'Cost', function: 'Sum' },
        },
      },
    });

    const columns = result.columns || [];
    const costIdx = columns.findIndex((c) => c.name === 'Cost');
    const dateIdx = columns.findIndex((c) => c.name === 'UsageDate');
    const typeIdx = columns.findIndex((c) => c.name === 'CostStatus');
    const currencyIdx = columns.findIndex((c) => c.name === 'Currency');

    const rows: AzureForecastRow[] = (result.rows || []).map((row: unknown[]) => ({
      date: String(row[dateIdx]),
      cost: Number(row[costIdx]),
      costType: String(row[typeIdx]) === 'Forecast' ? ('Forecast' as const) : ('Actual' as const),
      currency: String(row[currencyIdx] || 'USD'),
    }));

    return {
      rows,
      currency: rows[0]?.currency || 'USD',
    };
  }

  async getRecommendations(category?: string): Promise<AzureRecommendation[]> {
    const recommendations: AzureRecommendation[] = [];

    for await (const rec of this.advisorClient.recommendations.list()) {
      if (rec.category !== 'Cost') continue;
      if (category && category !== 'all') {
        const desc = (rec.shortDescription?.solution || '').toLowerCase();
        if (!desc.includes(category)) continue;
      }

      recommendations.push({
        id: rec.id || '',
        category: rec.category || 'Cost',
        impact: rec.impact || 'Unknown',
        description:
          rec.shortDescription?.solution || rec.shortDescription?.problem || 'No description',
        savingsAmount: rec.extendedProperties?.['savingsAmount']
          ? parseFloat(rec.extendedProperties['savingsAmount'])
          : undefined,
        savingsCurrency: rec.extendedProperties?.['savingsCurrency'] || 'USD',
        resourceId: rec.resourceMetadata?.resourceId,
      });
    }

    return recommendations;
  }

  async listBudgets(): Promise<AzureBudget[]> {
    const budgets: AzureBudget[] = [];

    for await (const budget of this.consumptionClient.budgets.list(this.scope)) {
      budgets.push({
        name: budget.name || 'Unnamed',
        amount: budget.amount || 0,
        timeGrain: budget.timeGrain || 'Monthly',
        currentSpend: budget.currentSpend?.amount || 0,
        forecastSpend: budget.forecastSpend?.amount || 0,
        currency: budget.currentSpend?.unit || 'USD',
      });
    }

    return budgets;
  }
}
