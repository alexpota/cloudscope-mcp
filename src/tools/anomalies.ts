import { formatMoney, formatTable } from '../utils/formatter.js';
import { toolResult, withProvider, type ToolResult, type Providers } from './types.js';
import { toDateString } from '../utils/dates.js';
import { MS_PER_DAY, NEW_SERVICE_CHANGE_PERCENT, DEFAULT_CURRENCY } from '../constants.js';

interface AnomaliesInput {
  provider: 'azure';
  days: number;
  threshold: number;
}

export async function handleDetectAnomalies(
  input: AnomaliesInput,
  providers: Providers,
): Promise<ToolResult> {
  return withProvider(providers, input.provider, async (provider) => {
    const now = new Date();
    const currentEnd = toDateString(now);
    const currentStart = toDateString(new Date(now.getTime() - input.days * MS_PER_DAY));
    const previousEnd = currentStart;
    const previousStart = toDateString(new Date(now.getTime() - input.days * 2 * MS_PER_DAY));

    const [current, previous] = await Promise.all([
      provider.queryCosts(currentStart, currentEnd, 'ServiceName'),
      provider.queryCosts(previousStart, previousEnd, 'ServiceName'),
    ]);

    const previousMap = new Map(previous.rows.map((r) => [r.name, r.cost]));

    const anomalies = current.rows
      .map((row) => {
        const prevCost = previousMap.get(row.name) || 0;
        const pctChange =
          prevCost > 0
            ? ((row.cost - prevCost) / prevCost) * 100
            : row.cost > 0
              ? NEW_SERVICE_CHANGE_PERCENT
              : 0;
        return {
          service: row.name,
          currentCost: row.cost,
          previousCost: prevCost,
          change: row.cost - prevCost,
          pctChange,
        };
      })
      .filter((a) => a.pctChange >= input.threshold)
      .sort((a, b) => b.pctChange - a.pctChange);

    if (anomalies.length === 0) {
      return toolResult(
        `No anomalies detected.\n\nCompared last ${input.days} days to previous ${input.days} days.\nThreshold: ${input.threshold}% increase.\nAll services are within normal spending range.`,
      );
    }

    const table = formatTable({
      headers: ['Service', 'Current', 'Previous', 'Change'],
      rows: anomalies.map((a) => [
        a.service,
        formatMoney(a.currentCost, DEFAULT_CURRENCY),
        formatMoney(a.previousCost, DEFAULT_CURRENCY),
        `${formatMoney(a.change, DEFAULT_CURRENCY)} increase (up ${a.pctChange.toFixed(1)}%)`,
      ]),
      alignRight: [1, 2],
    });

    const lines = [
      `Spending Anomalies Detected (last ${input.days} days vs previous ${input.days} days)`,
      `Threshold: >${input.threshold}% increase`,
      '',
      table,
      '',
      `${anomalies.length} service(s) with spending increases above ${input.threshold}%.`,
    ];

    return toolResult(lines.join('\n'));
  });
}
