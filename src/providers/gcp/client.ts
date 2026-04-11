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
  GCP_RECOMMENDER_CONCURRENCY,
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
  private readonly recommenderLimiter: RateLimiter;
  private readonly queryCache: Cache<CostQueryResult>;
  private readonly forecastCache: Cache<ForecastResult>;
  private readonly recommendationsCache: Cache<Recommendation[]>;
  private readonly idleCache: Cache<IdleResource[]>;

  /** Set during validate() — indicates whether resource.name column exists. */
  private hasDetailedExport = false;
  private bqClient: BigQueryClient | undefined;

  constructor(config: GcpConfig) {
    this.projectId = config.projectId;
    this.billingTable = config.billingTable;
    this.billingAccountId = config.billingAccountId;
    this.rateLimiter = createRateLimiter({ concurrency: GCP_BIGQUERY_CONCURRENCY });
    this.recommenderLimiter = createRateLimiter({ concurrency: GCP_RECOMMENDER_CONCURRENCY });
    this.queryCache = new Cache<CostQueryResult>(DEFAULT_CACHE_TTL_SECONDS, MAX_CACHE_ENTRIES);
    this.forecastCache = new Cache<ForecastResult>(DEFAULT_CACHE_TTL_SECONDS, MAX_CACHE_ENTRIES);
    this.recommendationsCache = new Cache<Recommendation[]>(
      DEFAULT_CACHE_TTL_SECONDS,
      MAX_CACHE_ENTRIES,
    );
    this.idleCache = new Cache<IdleResource[]>(DEFAULT_CACHE_TTL_SECONDS, MAX_CACHE_ENTRIES);
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

  /** Lists active zones from Compute Engine to scope Recommender calls. */
  private async listActiveZones(): Promise<string[]> {
    const { ZonesClient } = await import('@google-cloud/compute');
    const client = new ZonesClient({ fallback: true });
    const [zones] = await this.recommenderLimiter.run(() =>
      client.list({ project: this.projectId }),
    );
    return (zones ?? [])
      .filter((z) => z.status === 'UP')
      .map((z) => z.name ?? '')
      .filter(Boolean);
  }

  /** Cost recommender IDs for optimization suggestions. */
  private static readonly COST_RECOMMENDER_IDS = [
    'google.compute.instance.MachineTypeRecommender',
    'google.compute.commitment.UsageCommitmentRecommender',
  ] as const;

  /** Idle resource recommender IDs. */
  private static readonly IDLE_RECOMMENDER_IDS = [
    'google.compute.instance.IdleResourceRecommender',
    'google.compute.disk.IdleResourceRecommender',
    'google.compute.address.IdleResourceRecommender',
    'google.compute.image.IdleResourceRecommender',
    'google.cloudsql.instance.IdleRecommender',
  ] as const;

  /** Extracts monetary savings from a recommendation's primary impact. */
  private static extractSavings(rec: {
    primaryImpact?: {
      costProjection?: {
        cost?: { units?: string | number | Long | null; nanos?: number | null; currencyCode?: string | null };
      };
    };
  }): { amount: number; currency: string } | undefined {
    const cost = rec.primaryImpact?.costProjection?.cost;
    if (!cost) return undefined;
    const units = Number(cost.units ?? 0);
    const nanos = Number(cost.nanos ?? 0);
    // GCP savings are negative (cost reduction), so negate
    const amount = Math.abs(units + nanos / 1e9);
    if (amount === 0) return undefined;
    return { amount, currency: String(cost.currencyCode ?? DEFAULT_CURRENCY) };
  }

  /**
   * Fetches recommendations from the GCP Recommender API.
   * Iterates over active zones and the specified recommender IDs.
   */
  private async fetchRecommendations(
    recommenderIds: readonly string[],
  ): Promise<
    Array<{
      name: string;
      description: string;
      recommenderSubtype: string;
      primaryImpact?: unknown;
      content?: unknown;
    }>
  > {
    const { RecommenderClient } = await import('@google-cloud/recommender');
    const client = new RecommenderClient({ fallback: true });

    let zones: string[];
    try {
      zones = await this.listActiveZones();
    } catch {
      zones = [];
    }
    // Also include region-level recommenders (e.g., Cloud SQL uses regions)
    const locations = [...zones, ...new Set(zones.map((z) => z.replace(/-[a-z]$/, '')))];

    const results: Array<Record<string, unknown>> = [];

    await Promise.all(
      recommenderIds.flatMap((rid) =>
        locations.map((loc) =>
          this.recommenderLimiter.run(async () => {
            try {
              const parent = `projects/${this.projectId}/locations/${loc}/recommenders/${rid}`;
              const [recs] = await client.listRecommendations({ parent });
              for (const rec of recs) {
                results.push(rec as unknown as Record<string, unknown>);
              }
            } catch {
              // Location may not support this recommender — skip silently
            }
          }),
        ),
      ),
    );

    return results as Array<{
      name: string;
      description: string;
      recommenderSubtype: string;
      primaryImpact?: unknown;
      content?: unknown;
    }>;
  }

  async getRecommendations(category?: string): Promise<Recommendation[]> {
    const key = JSON.stringify({ category: category ?? 'all' });

    return this.recommendationsCache.getOrFetch(key, async () => {
      const recs = await this.fetchRecommendations(GcpCostClient.COST_RECOMMENDER_IDS);

      return recs.map((rec) => {
        const savings = GcpCostClient.extractSavings(
          rec as Parameters<typeof GcpCostClient.extractSavings>[0],
        );
        return {
          id: rec.name ?? '',
          category: 'Cost',
          impact: savings ? 'High' : 'Medium',
          description: rec.description ?? rec.recommenderSubtype ?? 'Cost optimization',
          savingsAmount: savings?.amount,
          savingsCurrency: savings?.currency,
          resourceId: rec.name,
        };
      });
    });
  }

  async listBudgets(): Promise<BudgetInfo[]> {
    throw new Error('GCP listBudgets not yet implemented');
  }

  async findIdleResources(): Promise<IdleResource[]> {
    return this.idleCache.getOrFetch('idle', async () => {
      const recs = await this.fetchRecommendations(GcpCostClient.IDLE_RECOMMENDER_IDS);

      return recs.map((rec) => {
        const savings = GcpCostClient.extractSavings(
          rec as Parameters<typeof GcpCostClient.extractSavings>[0],
        );
        return {
          name: rec.name?.split('/').pop() ?? rec.name ?? '',
          type: rec.recommenderSubtype ?? 'unknown',
          resourceGroup: this.projectId,
          reason: rec.description ?? 'Idle resource',
          estimatedMonthlyCost: savings?.amount ?? 0,
          currency: savings?.currency ?? DEFAULT_CURRENCY,
        };
      });
    });
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
