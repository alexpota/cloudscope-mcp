import { formatMoney, formatTable } from '../utils/formatter.js';
import { toolResult, withProvider, type ToolResult, type Providers } from './types.js';
import { MS_PER_DAY } from '../constants.js';

interface TopSpendersInput {
  provider: 'azure';
  days: number;
  limit: number;
}

export async function handleTopSpendingResources(
  input: TopSpendersInput,
  providers: Providers,
): Promise<ToolResult> {
  return withProvider(providers, input.provider, async (provider) => {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    const startDate = new Date(now.getTime() - input.days * MS_PER_DAY).toISOString().split('T')[0];

    const result = await provider.queryCosts(startDate, endDate, 'ResourceId');
    const sorted = [...result.rows].sort((a, b) => b.cost - a.cost).slice(0, input.limit);

    if (sorted.length === 0) {
      return toolResult(`No resource-level cost data found for the last ${input.days} days.`);
    }

    const total = result.rows.reduce((sum, r) => sum + r.cost, 0);

    const table = formatTable({
      headers: ['#', 'Resource', 'Cost', '% of Total'],
      rows: sorted.map((r, i) => [
        String(i + 1),
        extractResourceName(r.name),
        formatMoney(r.cost, result.currency),
        `${(total > 0 ? (r.cost / total) * 100 : 0).toFixed(1)}%`,
      ]),
      alignRight: [0, 2, 3],
    });

    const lines = [
      `Top ${sorted.length} Resources by Cost (last ${input.days} days)`,
      '',
      table,
      '',
      `Total across all resources: ${formatMoney(total, result.currency)}`,
      `Showing top ${sorted.length} of ${result.rows.length} resources`,
    ];

    return toolResult(lines.join('\n'));
  });
}

function extractResourceName(resourceId: string): string {
  const parts = resourceId.split('/');
  if (parts.length >= 2) {
    return `${parts[parts.length - 1]} (${parts[parts.length - 2]})`;
  }
  return resourceId;
}
