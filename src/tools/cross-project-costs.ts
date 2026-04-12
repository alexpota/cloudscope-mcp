import { formatMoney, formatTable } from '../utils/formatter.js';
import { toolResult, toolError, withProvider, type ToolResult, type Providers } from './types.js';
import { firstOfCurrentMonth, todayYMD, validateDateRange } from '../utils/dates.js';
import { DEFAULT_CURRENCY } from '../constants.js';
import type { GcpProjectInfo } from '../providers/gcp/discovery.js';

interface CrossProjectInput {
  provider: 'gcp';
  project_ids?: string[];
  start_date?: string;
  end_date?: string;
}

export async function handleCrossProjectCosts(
  input: CrossProjectInput,
  providers: Providers,
  projects: GcpProjectInfo[],
): Promise<ToolResult> {
  if (projects.length === 0) {
    return toolError(new Error('No GCP projects available.'));
  }

  const startDate = input.start_date || firstOfCurrentMonth();
  const endDate = input.end_date || todayYMD();

  const dateError = validateDateRange(startDate, endDate);
  if (dateError) return toolError(new Error(dateError));

  return withProvider(providers, 'gcp', async (provider) => {
    // Query costs grouped by project — BigQuery billing table covers all projects
    const result = await provider.queryCosts(startDate, endDate, 'resource_group');

    // Filter to requested projects if specified
    const targetIds = input.project_ids
      ? new Set(input.project_ids)
      : new Set(projects.map((p) => p.id));

    const filtered = result.rows.filter((r) => targetIds.has(r.name));
    const sorted = [...filtered].sort((a, b) => b.cost - a.cost);

    if (sorted.length === 0) {
      return toolResult('No cost data found for the specified GCP projects.');
    }

    const totalCost = sorted.reduce((sum, r) => sum + r.cost, 0);
    const currency = result.currency || DEFAULT_CURRENCY;

    // Map project IDs to display names
    const nameMap = new Map(projects.map((p) => [p.id, p.name]));

    const rows = sorted.map((r) => [
      nameMap.get(r.name) ?? r.name,
      formatMoney(r.cost, currency),
      totalCost > 0 ? `${((r.cost / totalCost) * 100).toFixed(1)}%` : '0.0%',
    ]);

    rows.push(['TOTAL', formatMoney(totalCost, currency), '100.0%']);

    const table = formatTable({
      headers: ['Project', `Cost (${currency})`, '% of Total'],
      rows,
      alignRight: [1, 2],
    });

    const lines = [
      `Cross-Project Cost Summary (${startDate} to ${endDate})`,
      '',
      table,
    ];

    return toolResult(lines.join('\n'));
  });
}
