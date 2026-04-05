import { formatMoney } from '../utils/formatter.js';
import { ProviderNotConfiguredError } from '../utils/errors.js';
import type { Providers } from './cost-summary.js';

interface AnomaliesInput {
  provider: 'azure' | 'gcp';
  days: number;
  threshold: number;
}

export async function handleDetectAnomalies(
  input: AnomaliesInput,
  providers: Providers,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    if (input.provider === 'azure') {
      if (!providers.azure) throw new ProviderNotConfiguredError('azure');

      const now = new Date();
      const currentEnd = now.toISOString().split('T')[0];
      const currentStart = new Date(now.getTime() - input.days * 86400000)
        .toISOString()
        .split('T')[0];
      const previousEnd = currentStart;
      const previousStart = new Date(now.getTime() - input.days * 2 * 86400000)
        .toISOString()
        .split('T')[0];

      const [current, previous] = await Promise.all([
        providers.azure.queryCosts(currentStart, currentEnd, 'ServiceName'),
        providers.azure.queryCosts(previousStart, previousEnd, 'ServiceName'),
      ]);

      const previousMap = new Map(
        previous.rows.map((r) => [r.serviceName, r.cost]),
      );

      const anomalies = current.rows
        .map((row) => {
          const prevCost = previousMap.get(row.serviceName) || 0;
          const pctChange =
            prevCost > 0
              ? ((row.cost - prevCost) / prevCost) * 100
              : row.cost > 0
                ? 100
                : 0;
          return {
            service: row.serviceName,
            currentCost: row.cost,
            previousCost: prevCost,
            change: row.cost - prevCost,
            pctChange,
          };
        })
        .filter((a) => a.pctChange >= input.threshold)
        .sort((a, b) => b.pctChange - a.pctChange);

      if (anomalies.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No anomalies detected.\n\nCompared last ${input.days} days to previous ${input.days} days.\nThreshold: ${input.threshold}% increase.\nAll services are within normal spending range.`,
            },
          ],
        };
      }

      const lines: string[] = [];
      lines.push(
        `Spending Anomalies Detected (last ${input.days} days vs previous ${input.days} days)`,
      );
      lines.push(`Threshold: >${input.threshold}% increase`);
      lines.push('');
      lines.push(
        `${'Service'.padEnd(30)} | ${'Current'.padStart(12)} | ${'Previous'.padStart(12)} | ${'Change'.padStart(18)}`,
      );
      lines.push(`${'-'.repeat(30)}-|-${'-'.repeat(12)}-|-${'-'.repeat(12)}-|-${'-'.repeat(18)}`);

      for (const a of anomalies) {
        lines.push(
          `${a.service.padEnd(30)} | ${formatMoney(a.currentCost, 'USD').padStart(12)} | ${formatMoney(a.previousCost, 'USD').padStart(12)} | +${a.pctChange.toFixed(1)}% (${formatMoney(a.change, 'USD')})`,
        );
      }

      lines.push('');
      lines.push(`${anomalies.length} service(s) with spending increases above ${input.threshold}%.`);

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    throw new ProviderNotConfiguredError('gcp');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
}
