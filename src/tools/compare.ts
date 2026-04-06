import { formatMoney, formatTable } from '../utils/formatter.js';
import { validateDateRange } from '../utils/dates.js';
import { GROUP_BY_MAP, DEFAULT_CURRENCY } from '../constants.js';
import { toolResult, toolError, withProvider, type ToolResult, type Providers } from './types.js';

interface CompareInput {
  provider: 'azure';
  period_a_start: string;
  period_a_end: string;
  period_b_start: string;
  period_b_end: string;
  group_by: 'service' | 'resource_group';
}

export async function handleComparePeriods(
  input: CompareInput,
  providers: Providers,
): Promise<ToolResult> {
  const errA = validateDateRange(input.period_a_start, input.period_a_end);
  if (errA) return toolError(new Error(`Period A: ${errA}`));
  const errB = validateDateRange(input.period_b_start, input.period_b_end);
  if (errB) return toolError(new Error(`Period B: ${errB}`));

  return withProvider(providers, input.provider, async (provider) => {
    const grouping = GROUP_BY_MAP[input.group_by] || 'ServiceName';

    const [periodA, periodB] = await Promise.all([
      provider.queryCosts(input.period_a_start, input.period_a_end, grouping),
      provider.queryCosts(input.period_b_start, input.period_b_end, grouping),
    ]);

    const mapA = new Map(periodA.rows.map((r) => [r.name, r.cost]));
    const mapB = new Map(periodB.rows.map((r) => [r.name, r.cost]));
    const allNames = new Set([...mapA.keys(), ...mapB.keys()]);
    const currency = periodA.currency || periodB.currency || DEFAULT_CURRENCY;

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

    const sign = (n: number) => (n >= 0 ? '+' : '');

    const table = formatTable({
      headers: [
        input.group_by === 'service' ? 'Service' : 'Resource Group',
        'Period A',
        'Period B',
        'Change',
      ],
      rows: [
        ...rows.map((r) => [
          r.name,
          formatMoney(r.costA, currency),
          formatMoney(r.costB, currency),
          `${sign(r.pctChange)}${r.pctChange.toFixed(1)}%`,
        ]),
        [
          'TOTAL',
          formatMoney(totalA, currency),
          formatMoney(totalB, currency),
          `${sign(totalPct)}${totalPct.toFixed(1)}%`,
        ],
      ],
      alignRight: [1, 2, 3],
    });

    const lines = [
      'Cost Comparison',
      `Period A: ${input.period_a_start} to ${input.period_a_end}`,
      `Period B: ${input.period_b_start} to ${input.period_b_end}`,
      '',
      table,
      '',
      `Net change: ${sign(totalDiff)}${formatMoney(totalDiff, currency)}`,
    ];

    return toolResult(lines.join('\n'));
  });
}
