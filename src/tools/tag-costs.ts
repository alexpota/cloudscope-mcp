import { formatCostTable } from '../utils/formatter.js';
import { MS_PER_DAY } from '../constants.js';
import { toolResult, toolError, withProvider, type ToolResult, type Providers } from './types.js';
import { firstOfCurrentMonth, todayYMD, validateDateRange } from '../utils/dates.js';

interface TagCostsInput {
  provider: 'azure' | 'gcp';
  tag_key: string;
  start_date?: string;
  end_date?: string;
}

export async function handleGetCostByTag(
  input: TagCostsInput,
  providers: Providers,
): Promise<ToolResult> {
  const startDate = input.start_date || firstOfCurrentMonth();
  const endDate = input.end_date || todayYMD();

  const dateError = validateDateRange(startDate, endDate);
  if (dateError) return toolError(new Error(dateError));

  return withProvider(providers, input.provider, async (provider) => {
    const result = await provider.queryCostsByTag(startDate, endDate, input.tag_key);

    if (result.rows.length === 0) {
      return toolResult(`No cost data found for tag "${input.tag_key}" in ${startDate} to ${endDate}.`);
    }

    const periodDays = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / MS_PER_DAY,
    ) + 1;

    return toolResult(
      formatCostTable({
        title: `Cost by Tag: ${input.tag_key} (${startDate} to ${endDate})`,
        groupLabel: input.tag_key,
        rows: result.rows,
        currency: result.currency,
        periodDays,
      }),
    );
  });
}
