export interface AzureCostRow {
  serviceName: string;
  cost: number;
  currency: string;
}

export interface AzureCostResult {
  rows: AzureCostRow[];
  currency: string;
}

export interface AzureRecommendation {
  id: string;
  category: string;
  impact: string;
  description: string;
  savingsAmount?: number;
  savingsCurrency?: string;
  resourceId?: string;
}

export type CostGrouping = 'ServiceName' | 'ResourceGroup' | 'ResourceLocation';

export interface AzureForecastRow {
  date: string;
  cost: number;
  costType: 'Actual' | 'Forecast';
  currency: string;
}

export interface AzureForecastResult {
  rows: AzureForecastRow[];
  currency: string;
}
