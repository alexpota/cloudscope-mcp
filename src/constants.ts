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

export const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

// Azure SDK surfaces 429 as either `statusCode: 429` or these `code` values.
export const AZURE_THROTTLE_ERROR_CODES: readonly string[] = ['TooManyRequests', '429'];

// Cost Management API returns bare 429s (no Retry-After) under burst load,
// which the Azure SDK's default retry policy does not handle. We compensate
// with our own concurrency limit + bounded retry loop (see utils/rate-limit).
export const AZURE_COST_MANAGEMENT_CONCURRENCY = 2;
export const AZURE_RETRY_MAX_ATTEMPTS = 3;
export const AZURE_RETRY_BASE_DELAY_MS = 1000;
export const AZURE_RETRY_MAX_DELAY_MS = 4000;

// Maps user-facing category enum → Azure resource type prefix in rec.impactedField.
// "networking" ≠ "microsoft.network" without this mapping.
export const ADVISOR_CATEGORY_RESOURCE_PREFIXES: Record<string, string> = {
  compute: 'microsoft.compute',
  storage: 'microsoft.storage',
  networking: 'microsoft.network',
};

// Azure Cost Management API
export const AZURE_TIMEFRAME_CUSTOM = 'Custom';
export const AZURE_CURRENCY_COLUMN = 'Currency';
export const AZURE_USAGE_DATE_COLUMN = 'UsageDate';
export const AZURE_COST_STATUS_COLUMN = 'CostStatus';
export const DEFAULT_BUDGET_NAME = 'Unnamed';
export const AZURE_COST_TYPE = 'ActualCost';
export const AZURE_COST_AGGREGATION_NAME = 'Cost';
export const AZURE_COST_AGGREGATION_FUNCTION = 'Sum';
export const AZURE_GROUPING_TYPE = 'Dimension';
export const AZURE_TAG_GROUPING_TYPE = 'TagKey';
export const AZURE_RESOURCE_ID_DIMENSION = 'ResourceId';
export const AZURE_TAG_VALUE_COLUMN = 'TagValue';
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

// Resource Graph KQL queries for idle resource detection
export const KQL_UNATTACHED_DISKS =
  'resources | where type == "microsoft.compute/disks" | where properties.diskState == "Unattached" | project name, type, resourceGroup, id';
export const KQL_ORPHANED_NICS =
  'resources | where type == "microsoft.network/networkinterfaces" | where isnull(properties.virtualMachine) | project name, type, resourceGroup, id';
export const KQL_UNUSED_PUBLIC_IPS =
  'resources | where type == "microsoft.network/publicipaddresses" | where properties.ipConfiguration == "" or isnull(properties.ipConfiguration) | project name, type, resourceGroup, id';
export const KQL_EMPTY_APP_SERVICE_PLANS =
  'resources | where type == "microsoft.web/serverfarms" | where properties.numberOfSites == 0 | project name, type, resourceGroup, id';
export const KQL_UNTAGGED_RESOURCES =
  'resources | where isnull(tags) or tags == "{}" | project name, type, resourceGroup, location';

export const IDLE_RESOURCE_REASONS: Record<string, string> = {
  'microsoft.compute/disks': 'Unattached disk',
  'microsoft.network/networkinterfaces': 'Orphaned network interface',
  'microsoft.network/publicipaddresses': 'Unused public IP',
  'microsoft.web/serverfarms': 'Empty App Service plan',
};

export const DEFAULT_IDLE_RESOURCE_COST_DAYS = 30;
