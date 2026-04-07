declare const __PKG_VERSION__: string;

// Package identity
export const PACKAGE_NAME = 'cloudscope-mcp';
export const PACKAGE_VERSION: string = __PKG_VERSION__;

// Tool defaults
export const DEFAULT_ANOMALY_DAYS = 7;
export const DEFAULT_ANOMALY_THRESHOLD = 20;
export const DEFAULT_FORECAST_DAYS = 30;
export const DEFAULT_TOP_RESOURCES_LIMIT = 10;
export const DEFAULT_TOP_RESOURCES_DAYS = 30;
export const DEFAULT_CACHE_TTL_SECONDS = 300;
export const MAX_CACHE_ENTRIES = 100;

// Date validation
export const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Cost grouping dimension mapping
export const GROUP_BY_MAP: Record<string, string> = {
  service: 'ServiceName',
  resource_group: 'ResourceGroup',
  region: 'ResourceLocation',
};

// Azure Cost Management API
export const AZURE_COST_TYPE = 'ActualCost';
export const AZURE_COST_AGGREGATION_NAME = 'Cost';
export const AZURE_COST_AGGREGATION_FUNCTION = 'Sum';
export const AZURE_GROUPING_TYPE = 'Dimension';
export const AZURE_GRANULARITY_NONE = 'None';
export const AZURE_GRANULARITY_DAILY = 'Daily';
export const AZURE_COST_CATEGORY = 'Cost';
export const DEFAULT_CURRENCY = 'USD';

// Budget risk thresholds (percentage of budget)
export const BUDGET_RISK_OVER_THRESHOLD = 100;
export const BUDGET_RISK_HIGH_THRESHOLD = 90;
export const BUDGET_RISK_WARN_THRESHOLD = 80;
export const BUDGET_RISK_LABELS = {
  OVER: 'OVER',
  HIGH: 'HIGH',
  WARN: 'WARN',
  OK: 'OK',
} as const;

// Time
export const MS_PER_DAY = 86400000;

// Forecast cost status
export const COST_STATUS_FORECAST = 'Forecast';
export const COST_STATUS_ACTUAL = 'Actual';

// Anomaly detection
export const NEW_SERVICE_CHANGE_PERCENT = 100;
