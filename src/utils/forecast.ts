import type { ForecastRow } from '../providers/types.js';

interface DailyCost {
  date: string;
  cost: number;
}

/**
 * Computes a linear regression forecast from historical daily cost data.
 * Returns actual rows for historical days and forecast rows for projected days.
 *
 * Requires at least 2 historical data points. Returns an empty array if
 * insufficient data is provided.
 */
export function linearForecast(
  historical: DailyCost[],
  forecastDays: number,
): ForecastRow[] {
  if (historical.length < 2 || forecastDays <= 0) return [];

  const sorted = [...historical].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // Simple linear regression: y = mx + b
  const n = sorted.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    const cost = sorted[i]?.cost ?? 0;
    sumX += i;
    sumY += cost;
    sumXY += i * cost;
    sumXX += i * i;
  }

  const denominator = n * sumXX - sumX * sumX;
  // All x-values identical (shouldn't happen with sequential indices, but guard)
  if (denominator === 0) return [];

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const rows: ForecastRow[] = [];

  // Actual rows
  for (let i = 0; i < n; i++) {
    const entry = sorted[i];
    if (entry) {
      rows.push({ date: entry.date, cost: entry.cost, costType: 'Actual' });
    }
  }

  // Forecast rows
  const lastDate = sorted[n - 1]?.date;
  if (!lastDate) return rows;
  const lastTime = new Date(lastDate).getTime();
  const MS_PER_DAY = 86400000;

  for (let d = 1; d <= forecastDays; d++) {
    const forecastDate = new Date(lastTime + d * MS_PER_DAY).toISOString().split('T')[0] ?? '';
    const forecastCost = Math.max(0, slope * (n - 1 + d) + intercept);
    rows.push({ date: forecastDate, cost: forecastCost, costType: 'Forecast' });
  }

  return rows;
}
