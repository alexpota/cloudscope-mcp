import { formatCostTable } from '../utils/formatter.js';
import { validateDateRange, todayYMD, firstOfCurrentMonth } from '../utils/dates.js';
import { toolResult, toolError, withProvider, type ToolResult, type Providers } from './types.js';
import type { GroupByKey } from '../providers/types.js';

interface CostSummaryInput {
  provider: 'azure' | 'gcp';
  start_date?: string;
  end_date?: string;
  group_by: 'service' | 'resource_group' | 'tag' | 'region';
}

export type { Providers };

export async function handleGetCostSummary(
  input: CostSummaryInput,
  providers: Providers,
): Promise<ToolResult> {
  const startDate = input.start_date || firstOfCurrentMonth();
  const endDate = input.end_date || todayYMD();

  const dateError = validateDateRange(startDate, endDate);
  if (dateError) return toolError(new Error(dateError));

  return withProvider(providers, input.provider, async (provider) => {
    const groupBy: GroupByKey = input.group_by === 'tag' ? 'service' : input.group_by;
    const result = await provider.queryCosts(startDate, endDate, groupBy);

    const periodDays = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24),
    );

    const groupLabel =
      input.group_by === 'service'
        ? 'Service'
        : input.group_by === 'resource_group'
          ? 'Resource Group'
          : 'Region';

    return toolResult(
      formatCostTable({
        title: `Azure Cost Summary (${startDate} to ${endDate})`,
        groupLabel,
        rows: result.rows,
        currency: result.currency,
        periodDays,
      }),
    );
  });
}
