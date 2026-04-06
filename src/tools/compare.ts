import { formatMoney } from '../utils/formatter.js';
import { ProviderNotConfiguredError } from '../utils/errors.js';
import type { Providers } from './cost-summary.js';
import type { CostGrouping } from '../providers/azure/types.js';
import { toolResult, toolError, type ToolResult } from './types.js';

interface CompareInput {
  provider: 'azure';
  period_a_start: string;
  period_a_end: string;
  period_b_start: string;
  period_b_end: string;
  group_by: 'service' | 'resource_group';
}

const GROUP_BY_MAP: Record<string, CostGrouping> = {
  service: 'ServiceName',
  resource_group: 'ResourceGroup',
};

export async function handleComparePeriods(
  input: CompareInput,
  providers: Providers,
): Promise<ToolResult> {
  try {
    if (!providers.azure) throw new ProviderNotConfiguredError();

    const grouping = GROUP_BY_MAP[input.group_by] || 'ServiceName';

    const [periodA, periodB] = await Promise.all([
      providers.azure.queryCosts(input.period_a_start, input.period_a_end, grouping),
      providers.azure.queryCosts(input.period_b_start, input.period_b_end, grouping),
    ]);

    const mapA = new Map(periodA.rows.map((r) => [r.serviceName, r.cost]));
    const mapB = new Map(periodB.rows.map((r) => [r.serviceName, r.cost]));

    const allNames = new Set([...mapA.keys(), ...mapB.keys()]);
    const currency = periodA.currency || periodB.currency || 'USD';

    const rows = [...allNames]
      .map((name) => {
        const costA = mapA.get(name) || 0;
        const costB = mapB.get(name) || 0;
        const diff = costB - costA;
        const pctChange = costA > 0 ? (diff / costA) * 100 : costB > 0 ? 100 : 0;
        return { name, costA, costB, diff, pctChange };
      })
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    const totalA = rows.reduce((sum, r) => sum + r.costA, 0);
    const totalB = rows.reduce((sum, r) => sum + r.costB, 0);
    const totalDiff = totalB - totalA;
    const totalPct = totalA > 0 ? (totalDiff / totalA) * 100 : 0;

    const groupLabel = input.group_by === 'service' ? 'Service' : 'Resource Group';
    const nameWidth = Math.max(groupLabel.length, ...rows.map((r) => r.name.length), 5);

    const lines: string[] = [];
    lines.push(`Cost Comparison`);
    lines.push(`Period A: ${input.period_a_start} to ${input.period_a_end}`);
    lines.push(`Period B: ${input.period_b_start} to ${input.period_b_end}`);
    lines.push('');
    lines.push(
      `${groupLabel.padEnd(nameWidth)} | ${'Period A'.padStart(12)} | ${'Period B'.padStart(12)} | ${'Change'.padStart(14)}`,
    );
    lines.push(
      `${'-'.repeat(nameWidth)}-|-${'-'.repeat(12)}-|-${'-'.repeat(12)}-|-${'-'.repeat(14)}`,
    );

    for (const r of rows) {
      const sign = r.diff >= 0 ? '+' : '';
      const change = `${sign}${r.pctChange.toFixed(1)}%`;
      lines.push(
        `${r.name.padEnd(nameWidth)} | ${formatMoney(r.costA, currency).padStart(12)} | ${formatMoney(r.costB, currency).padStart(12)} | ${change.padStart(14)}`,
      );
    }

    lines.push(
      `${'-'.repeat(nameWidth)}-|-${'-'.repeat(12)}-|-${'-'.repeat(12)}-|-${'-'.repeat(14)}`,
    );
    const totalSign = totalDiff >= 0 ? '+' : '';
    lines.push(
      `${'TOTAL'.padEnd(nameWidth)} | ${formatMoney(totalA, currency).padStart(12)} | ${formatMoney(totalB, currency).padStart(12)} | ${(totalSign + totalPct.toFixed(1) + '%').padStart(14)}`,
    );
    lines.push('');
    lines.push(`Net change: ${totalSign}${formatMoney(totalDiff, currency)}`);

    return toolResult(lines.join('\n'));
  } catch (error) {
    return toolError(error);
  }
}
