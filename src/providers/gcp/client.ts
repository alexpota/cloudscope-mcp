import type { GcpConfig } from '../../config.js';
import type {
  CloudCostProvider,
  CostQueryResult,
  ForecastResult,
  Recommendation,
  BudgetInfo,
  IdleResource,
  UntaggedResource,
  GroupByKey,
} from '../types.js';
import {
  DEFAULT_CACHE_TTL_SECONDS,
  DEFAULT_CURRENCY,
  GCP_BIGQUERY_CONCURRENCY,
  GCP_RETRY_MAX_ATTEMPTS,
  GCP_RETRY_BASE_DELAY_MS,
  GCP_RETRY_MAX_DELAY_MS,
  MAX_CACHE_ENTRIES,
} from '../../constants.js';
import { Cache } from '../../utils/cache.js';
import { createRateLimiter, withRetry, type RateLimiter } from '../../utils/rate-limit.js';
import { linearForecast } from '../../utils/forecast.js';
import { toDateString } from '../../utils/dates.js';
import { isGcpThrottlingError } from './throttling.js';
import {
  GCP_GROUPING_MAP,
  buildCostQuery,
  COST_BY_TAG_QUERY,
  DAILY_COST_QUERY,
  VALIDATE_QUERY,
  DETAILED_EXPORT_PROBE,
  interpolateTable,
} from './queries.js';

/** Lazily-loaded BigQuery client type. */
type BigQueryClient = InstanceType<typeof import('@google-cloud/bigquery').BigQuery>;

export class GcpCostClient implements CloudCostProvider {
  readonly projectId: string;
  readonly billingTable: string;
  readonly billingAccountId: string | undefined;
  private readonly rateLimiter: RateLimiter;
  private readonly queryCache: Cache<CostQueryResult>;
  private readonly forecastCache: Cache<ForecastResult>;

  /** Set during validate() — indicates whether resource.name column exists. */
  private hasDetailedExport = false;
  private bqClient: BigQueryClient | undefined;

  constructor(config: GcpConfig) {
    this.projectId = config.projectId;
    this.billingTable = config.billingTable;
    this.billingAccountId = config.billingAccountId;
    this.rateLimiter = createRateLimiter({ concurrency: GCP_BIGQUERY_CONCURRENCY });
    this.queryCache = new Cache<CostQueryResult>(DEFAULT_CACHE_TTL_SECONDS, MAX_CACHE_ENTRIES);
    this.forecastCache = new Cache<ForecastResult>(DEFAULT_CACHE_TTL_SECONDS, MAX_CACHE_ENTRIES);
  }

  /** Lazily initializes and returns the BigQuery client. */
  private async getBigQuery(): Promise<BigQueryClient> {
    if (!this.bqClient) {
      const { BigQuery } = await import('@google-cloud/bigquery');
      this.bqClient = new BigQuery({ projectId: this.projectId });
    }
    return this.bqClient;
  }

  /** Wraps a BigQuery call with concurrency limiting and retry. */
  private async callGcp<T>(fn: () => Promise<T>): Promise<T> {
    return withRetry(() => this.rateLimiter.run(fn), {
      isRetryable: isGcpThrottlingError,
      maxAttempts: GCP_RETRY_MAX_ATTEMPTS,
      baseDelayMs: GCP_RETRY_BASE_DELAY_MS,
      maxDelayMs: GCP_RETRY_MAX_DELAY_MS,
    });
  }

  /** Runs a parameterized BigQuery query and returns rows. */
  private async runQuery(
    sql: string,
    params: Record<string, string>,
  ): Promise<Array<Record<string, unknown>>> {
    const bq = await this.getBigQuery();
    const query = interpolateTable(sql, this.billingTable);
    const [rows] = await this.callGcp(() =>
      bq.query({ query, params, location: undefined }),
    );
    return rows as Array<Record<string, unknown>>;
  }

  async queryCosts(
    startDate: string,
    endDate: string,
    groupBy: GroupByKey,
  ): Promise<CostQueryResult> {
    if (groupBy === 'resource_id' && !this.hasDetailedExport) {
      return {
        rows: [],
        currency: DEFAULT_CURRENCY,
      };
    }

    const groupingColumn = GCP_GROUPING_MAP[groupBy];
    const sql = buildCostQuery(groupingColumn);
    const key = JSON.stringify({ startDate, endDate, groupBy });

    return this.queryCache.getOrFetch(key, async () => {
      const rows = await this.runQuery(sql, { startDate, endDate });
      return {
        rows: rows.map((r) => ({
          name: String(r['name'] ?? ''),
          cost: Number(r['cost'] ?? 0),
        })),
        currency: String(rows[0]?.['currency'] ?? DEFAULT_CURRENCY),
      };
    });
  }

  async queryCostsByTag(
    startDate: string,
    endDate: string,
    tagKey: string,
  ): Promise<CostQueryResult> {
    const key = JSON.stringify({ startDate, endDate, tagKey, type: 'tag' });

    return this.queryCache.getOrFetch(key, async () => {
      const rows = await this.runQuery(COST_BY_TAG_QUERY, {
        startDate,
        endDate,
        tagKey,
      });
      return {
        rows: rows.map((r) => ({
          name: String(r['name'] ?? ''),
          cost: Number(r['cost'] ?? 0),
        })),
        currency: String(rows[0]?.['currency'] ?? DEFAULT_CURRENCY),
      };
    });
  }

  async forecastCosts(startDate: string, endDate: string): Promise<ForecastResult> {
    const key = JSON.stringify({ startDate, endDate, type: 'forecast' });

    return this.forecastCache.getOrFetch(key, async () => {
      // Fetch 30 days of historical data ending at startDate for trend computation
      const historyEnd = startDate;
      const historyStart = toDateString(
        new Date(new Date(startDate).getTime() - 30 * 86400000),
      );

      const rows = await this.runQuery(DAILY_COST_QUERY, {
        startDate: historyStart,
        endDate: historyEnd,
      });

      const historical = rows.map((r) => ({
        date: String(r['date'] ?? ''),
        cost: Number(r['cost'] ?? 0),
      }));

      const forecastDays = Math.max(
        1,
        Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
        ),
      );

      const forecastRows = linearForecast(historical, forecastDays);
      const currency = String(rows[0]?.['currency'] ?? DEFAULT_CURRENCY);

      return { rows: forecastRows, currency };
    });
  }

  async getRecommendations(_category?: string): Promise<Recommendation[]> {
    throw new Error('GCP getRecommendations not yet implemented');
  }

  async listBudgets(): Promise<BudgetInfo[]> {
    throw new Error('GCP listBudgets not yet implemented');
  }

  async findIdleResources(): Promise<IdleResource[]> {
    throw new Error('GCP findIdleResources not yet implemented');
  }

  async findUntaggedResources(): Promise<UntaggedResource[]> {
    throw new Error('GCP findUntaggedResources not yet implemented');
  }

  async validate(): Promise<{ connected: boolean; detail: string }> {
    try {
      await this.runQuery(VALIDATE_QUERY, {});

      // Probe for detailed export
      try {
        await this.runQuery(DETAILED_EXPORT_PROBE, {});
        this.hasDetailedExport = true;
      } catch {
        this.hasDetailedExport = false;
      }

      const exportType = this.hasDetailedExport ? 'detailed' : 'standard';
      return {
        connected: true,
        detail: `project: ${this.projectId}, export: ${exportType}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { connected: false, detail: message };
    }
  }
}
