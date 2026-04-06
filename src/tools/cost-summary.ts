import type { AzureCostClient } from '../providers/azure/client.js';
import { formatCostTable } from '../utils/formatter.js';
import { ProviderNotConfiguredError } from '../utils/errors.js';
import { validateDateRange, todayYMD, firstOfCurrentMonth } from '../utils/dates.js';
import type { CostGrouping } from '../providers/azure/types.js';
import { toolResult, toolError, type ToolResult } from './types.js';

export interface Providers {
  azure: AzureCostClient | null;
}

interface CostSummaryInput {
  provider: 'azure';
  start_date?: string;
  end_date?: string;
  group_by: 'service' | 'resource_group' | 'tag' | 'region';
}

const GROUP_BY_MAP: Record<string, CostGrouping> = {
  service: 'ServiceName',
  resource_group: 'ResourceGroup',
  region: 'ResourceLocation',
};

export async function handleGetCostSummary(
  input: CostSummaryInput,
  providers: Providers,
): Promise<ToolResult> {
  try {
    if (!providers.azure) throw new ProviderNotConfiguredError();

    const startDate = input.start_date || firstOfCurrentMonth();
    const endDate = input.end_date || todayYMD();

    const dateError = validateDateRange(startDate, endDate);
    if (dateError) return toolError(new Error(dateError));

    const grouping = GROUP_BY_MAP[input.group_by] || 'ServiceName';
    const result = await providers.azure.queryCosts(startDate, endDate, grouping);

    const periodDays = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24),
    );

    const groupLabel =
      input.group_by === 'service'
        ? 'Service'
        : input.group_by === 'resource_group'
          ? 'Resource Group'
          : 'Region';

    const text = formatCostTable({
      title: `Azure Cost Summary (${startDate} to ${endDate})`,
      groupLabel,
      rows: result.rows.map((r) => ({ name: r.serviceName, cost: r.cost })),
      currency: result.currency,
      periodDays,
    });

    return toolResult(text);
  } catch (error) {
    return toolError(error);
  }
}
