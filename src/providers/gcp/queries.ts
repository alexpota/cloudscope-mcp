import type { GroupByKey } from '../types.js';

/**
 * Maps user-facing GroupByKey to BigQuery column expressions.
 * Standard export columns work for service/region; resource_id requires
 * the detailed export (gcp_billing_export_resource_v1_*).
 */
export const GCP_GROUPING_MAP: Record<GroupByKey, string> = {
  service: 'service.description',
  resource_group: 'project.id',
  region: 'location.region',
  resource_id: 'resource.name',
};

/** Net cost expression: base cost + all credits (discounts, CUDs, etc.). */
const NET_COST = `SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) AS c), 0))`;

/**
 * Cost grouped by a dimension.
 * Parameters: @startDate (STRING), @endDate (STRING)
 * The grouping column is interpolated (not parameterized) because BigQuery
 * does not support parameterized column names.
 */
export function buildCostQuery(groupingColumn: string): string {
  return `
SELECT
  ${groupingColumn} AS name,
  ${NET_COST} AS cost,
  currency
FROM \`{BILLING_TABLE}\`
WHERE usage_start_time >= TIMESTAMP(@startDate)
  AND usage_start_time < TIMESTAMP(@endDate)
GROUP BY name, currency
HAVING cost != 0
ORDER BY cost DESC`.trim();
}

/**
 * Cost grouped by a label (tag) key.
 * Parameters: @startDate (STRING), @endDate (STRING), @tagKey (STRING)
 */
export const COST_BY_TAG_QUERY = `
SELECT
  label.value AS name,
  ${NET_COST} AS cost,
  currency
FROM \`{BILLING_TABLE}\`,
  UNNEST(labels) AS label
WHERE usage_start_time >= TIMESTAMP(@startDate)
  AND usage_start_time < TIMESTAMP(@endDate)
  AND label.key = @tagKey
GROUP BY name, currency
HAVING cost != 0
ORDER BY cost DESC`.trim();

/**
 * Daily cost totals for forecast computation.
 * Parameters: @startDate (STRING), @endDate (STRING)
 */
export const DAILY_COST_QUERY = `
SELECT
  FORMAT_DATE('%Y-%m-%d', DATE(usage_start_time)) AS date,
  ${NET_COST} AS cost,
  currency
FROM \`{BILLING_TABLE}\`
WHERE usage_start_time >= TIMESTAMP(@startDate)
  AND usage_start_time < TIMESTAMP(@endDate)
GROUP BY date, currency
ORDER BY date`.trim();

/**
 * Lightweight validation query — returns 1 row if the table exists and is readable.
 */
export const VALIDATE_QUERY = `SELECT 1 AS ok FROM \`{BILLING_TABLE}\` LIMIT 1`;

/**
 * Probe for detailed export — checks whether resource.name column exists.
 * Fails with a column-not-found error on standard export tables.
 */
export const DETAILED_EXPORT_PROBE = `SELECT resource.name FROM \`{BILLING_TABLE}\` LIMIT 0`;

/** Replaces the {BILLING_TABLE} placeholder with the actual table identifier. */
export function interpolateTable(query: string, billingTable: string): string {
  return query.replace(/\{BILLING_TABLE\}/g, billingTable);
}
