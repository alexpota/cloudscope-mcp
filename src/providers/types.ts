export interface CostQueryResult {
  rows: Array<{ name: string; cost: number }>;
  currency: string;
}

export interface ForecastRow {
  date: string;
  cost: number;
  costType: 'Actual' | 'Forecast';
}

export interface ForecastResult {
  rows: ForecastRow[];
  currency: string;
}

export interface Recommendation {
  id: string;
  category: string;
  impact: string;
  description: string;
  savingsAmount?: number;
  savingsCurrency?: string;
  resourceId?: string;
}

export interface BudgetInfo {
  name: string;
  amount: number;
  currentSpend: number;
  forecastSpend: number;
  currency: string;
}

export interface IdleResource {
  name: string;
  type: string;
  resourceGroup: string;
  reason: string;
  estimatedMonthlyCost: number;
  currency: string;
}

export interface UntaggedResource {
  name: string;
  type: string;
  resourceGroup: string;
  location: string;
}

export type GroupByKey = 'service' | 'resource_group' | 'region' | 'resource_id';

export interface CloudCostProvider {
  queryCosts(start: string, end: string, groupBy: GroupByKey): Promise<CostQueryResult>;
  queryCostsByTag(start: string, end: string, tagKey: string): Promise<CostQueryResult>;
  findIdleResources(): Promise<IdleResource[]>;
  findUntaggedResources(): Promise<UntaggedResource[]>;
  getRecommendations(category?: string): Promise<Recommendation[]>;
  listBudgets(): Promise<BudgetInfo[]>;
  forecastCosts(start: string, end: string): Promise<ForecastResult>;
  validate(): Promise<{ connected: boolean; detail: string }>;
}
