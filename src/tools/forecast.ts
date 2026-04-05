import { formatMoney } from '../utils/formatter.js';
import { ProviderNotConfiguredError } from '../utils/errors.js';
import type { Providers } from './cost-summary.js';
import { toolResult, toolError, type ToolResult } from './types.js';

interface ForecastInput {
  provider: 'azure';
  days: number;
}

export async function handleGetCostForecast(
  input: ForecastInput,
  providers: Providers,
): Promise<ToolResult> {
  try {
    if (!providers.azure) throw new ProviderNotConfiguredError();

    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    const endDate = new Date(now.getTime() + input.days * 86400000).toISOString().split('T')[0];

    const result = await providers.azure.forecastCosts(startDate, endDate);

    const actualRows = result.rows.filter((r) => r.costType === 'Actual');
    const forecastRows = result.rows.filter((r) => r.costType === 'Forecast');

    const actualTotal = actualRows.reduce((sum, r) => sum + r.cost, 0);
    const forecastTotal = forecastRows.reduce((sum, r) => sum + r.cost, 0);
    const projectedTotal = actualTotal + forecastTotal;

    const lines: string[] = [];
    lines.push(`Azure Cost Forecast (${startDate} to ${endDate})`);
    lines.push('');
    lines.push(`Accrued to date:       ${formatMoney(actualTotal, result.currency)}`);
    lines.push(`Forecasted remaining:  ${formatMoney(forecastTotal, result.currency)}`);
    lines.push(`Projected total:       ${formatMoney(projectedTotal, result.currency)}`);
    lines.push('');

    if (input.days > 0) {
      const dailyAvg = projectedTotal / input.days;
      lines.push(`Projected daily average: ${formatMoney(dailyAvg, result.currency)}`);
    }

    if (forecastRows.length > 0) {
      lines.push('');
      lines.push('Daily Forecast:');
      lines.push(`${'Date'.padEnd(12)} | ${'Cost'.padStart(12)} | Type`);
      lines.push(`${'-'.repeat(12)}-|-${'-'.repeat(12)}-|--------`);

      const allRows = [...result.rows].sort((a, b) => a.date.localeCompare(b.date));

      for (const row of allRows) {
        const dateStr = formatDate(row.date);
        lines.push(
          `${dateStr.padEnd(12)} | ${formatMoney(row.cost, result.currency).padStart(12)} | ${row.costType}`,
        );
      }
    }

    return toolResult(lines.join('\n'));
  } catch (error) {
    return toolError(error);
  }
}

function formatDate(raw: string): string {
  const s = String(raw).replace(/-/g, '');
  if (s.length === 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return raw;
}
