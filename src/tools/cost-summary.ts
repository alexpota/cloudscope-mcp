import type { AzureCostClient } from '../providers/azure/client.js';
import { formatCostTable } from '../utils/formatter.js';
import { ProviderNotConfiguredError } from '../utils/errors.js';
import type { CostGrouping } from '../providers/azure/types.js';

export interface Providers {
  azure: AzureCostClient | null;
  gcp: null;
}

interface CostSummaryInput {
  provider: 'azure' | 'gcp';
  start_date: string;
  end_date: string;
  group_by: 'service' | 'resource_group' | 'tag' | 'region';
  tag_key?: string;
  tag_value?: string;
}

const GROUP_BY_MAP: Record<string, CostGrouping> = {
  service: 'ServiceName',
  resource_group: 'ResourceGroup',
  region: 'ResourceLocation',
};

export async function handleGetCostSummary(
  input: CostSummaryInput,
  providers: Providers,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    if (input.provider === 'azure') {
      if (!providers.azure) throw new ProviderNotConfiguredError('azure');

      const grouping = GROUP_BY_MAP[input.group_by] || 'ServiceName';
      const result = await providers.azure.queryCosts(
        input.start_date,
        input.end_date,
        grouping,
      );

      const startDate = new Date(input.start_date);
      const endDate = new Date(input.end_date);
      const periodDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      const groupLabel = input.group_by === 'service' ? 'Service'
        : input.group_by === 'resource_group' ? 'Resource Group'
        : 'Region';

      const text = formatCostTable({
        title: `Azure Cost Summary (${input.start_date} to ${input.end_date})`,
        groupLabel,
        rows: result.rows.map((r) => ({ name: r.serviceName, cost: r.cost })),
        currency: result.currency,
        periodDays,
      });

      return { content: [{ type: 'text', text }] };
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
