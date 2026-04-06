import { formatMoney, formatTable } from '../utils/formatter.js';
import { toolResult, withProvider, type ToolResult, type Providers } from './types.js';
import { toDateString } from '../utils/dates.js';
import { MS_PER_DAY, COST_STATUS_FORECAST, COST_STATUS_ACTUAL } from '../constants.js';

interface ForecastInput {
  provider: 'azure';
  days: number;
}

export async function handleGetCostForecast(
  input: ForecastInput,
  providers: Providers,
): Promise<ToolResult> {
  return withProvider(providers, input.provider, async (provider) => {
    const now = new Date();
    const startDate = toDateString(now);
    const endDate = toDateString(new Date(now.getTime() + input.days * MS_PER_DAY));

    const result = await provider.forecastCosts(startDate, endDate);

    const actualTotal = result.rows
      .filter((r) => r.costType === COST_STATUS_ACTUAL)
      .reduce((s, r) => s + r.cost, 0);
    const forecastTotal = result.rows
      .filter((r) => r.costType === COST_STATUS_FORECAST)
      .reduce((s, r) => s + r.cost, 0);
    const projectedTotal = actualTotal + forecastTotal;

    const lines: string[] = [
      `Cost Forecast (${startDate} to ${endDate})`,
      '',
      `Accrued to date:       ${formatMoney(actualTotal, result.currency)}`,
      `Forecasted remaining:  ${formatMoney(forecastTotal, result.currency)}`,
      `Projected total:       ${formatMoney(projectedTotal, result.currency)}`,
      '',
    ];

    if (input.days > 0) {
      lines.push(
        `Projected daily average: ${formatMoney(projectedTotal / input.days, result.currency)}`,
      );
    }

    const forecastRows = result.rows.filter((r) => r.costType === COST_STATUS_FORECAST);
    if (forecastRows.length > 0) {
      const allSorted = [...result.rows].sort((a, b) => a.date.localeCompare(b.date));
      const table = formatTable({
        headers: ['Date', 'Cost', 'Type'],
        rows: allSorted.map((r) => [
          formatDate(r.date),
          formatMoney(r.cost, result.currency),
          r.costType,
        ]),
        alignRight: [1],
      });
      lines.push('', 'Daily Forecast:', table);
    }

    return toolResult(lines.join('\n'));
  });
}

function formatDate(raw: string): string {
  const s = String(raw).replace(/-/g, '');
  if (s.length === 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return raw;
}
