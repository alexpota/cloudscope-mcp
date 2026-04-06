import { formatMoney } from '../utils/formatter.js';
import { ProviderNotConfiguredError } from '../utils/errors.js';
import type { Providers } from './cost-summary.js';
import { toolResult, toolError, type ToolResult } from './types.js';

interface TopSpendersInput {
  provider: 'azure';
  days: number;
  limit: number;
}

export async function handleTopSpendingResources(
  input: TopSpendersInput,
  providers: Providers,
): Promise<ToolResult> {
  try {
    if (!providers.azure) throw new ProviderNotConfiguredError();

    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    const startDate = new Date(now.getTime() - input.days * 86400000).toISOString().split('T')[0];

    const result = await providers.azure.queryCosts(startDate, endDate, 'ResourceId');

    const sorted = [...result.rows].sort((a, b) => b.cost - a.cost).slice(0, input.limit);

    if (sorted.length === 0) {
      return toolResult(`No resource-level cost data found for the last ${input.days} days.`);
    }

    const total = result.rows.reduce((sum, r) => sum + r.cost, 0);
    const currency = result.currency;

    const lines: string[] = [];
    lines.push(`Top ${sorted.length} Resources by Cost (last ${input.days} days)`);
    lines.push('');
    lines.push(
      `${'#'.padStart(3)} | ${'Resource'.padEnd(50)} | ${'Cost'.padStart(12)} | ${'% of Total'.padStart(10)}`,
    );
    lines.push(`${'-'.repeat(3)}-|-${'-'.repeat(50)}-|-${'-'.repeat(12)}-|-${'-'.repeat(10)}`);

    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const resourceName = extractResourceName(r.serviceName);
      const pct = total > 0 ? ((r.cost / total) * 100).toFixed(1) : '0.0';
      lines.push(
        `${String(i + 1).padStart(3)} | ${resourceName.padEnd(50)} | ${formatMoney(r.cost, currency).padStart(12)} | ${(pct + '%').padStart(10)}`,
      );
    }

    lines.push('');
    lines.push(`Total across all resources: ${formatMoney(total, currency)}`);
    lines.push(`Showing top ${sorted.length} of ${result.rows.length} resources`);

    return toolResult(lines.join('\n'));
  } catch (error) {
    return toolError(error);
  }
}

function extractResourceName(resourceId: string): string {
  // Azure resource IDs are long ARM paths, extract the meaningful part
  const parts = resourceId.split('/');
  if (parts.length >= 2) {
    const name = parts[parts.length - 1];
    const type = parts[parts.length - 2];
    return `${name} (${type})`;
  }
  return resourceId;
}
