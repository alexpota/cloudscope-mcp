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

export interface CloudCostProvider {
  queryCosts(start: string, end: string, grouping: string): Promise<CostQueryResult>;
  getRecommendations(category?: string): Promise<Recommendation[]>;
  listBudgets(): Promise<BudgetInfo[]>;
  forecastCosts(start: string, end: string): Promise<ForecastResult>;
  validate(): Promise<{ connected: boolean; detail: string }>;
}
