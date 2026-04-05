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
