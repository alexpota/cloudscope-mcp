import { formatMoney, formatTable } from '../utils/formatter.js';
import { toolResult, withProvider, type ToolResult, type Providers } from './types.js';

interface IdleResourcesInput {
  provider: 'azure';
}

export async function handleFindIdleResources(
  input: IdleResourcesInput,
  providers: Providers,
): Promise<ToolResult> {
  return withProvider(providers, input.provider, async (provider) => {
    const resources = await provider.findIdleResources();

    if (resources.length === 0) {
      return toolResult('No idle resources found. All provisioned resources appear to be in use.');
    }

    const rows = resources.map((r, i) => [
      String(i + 1),
      r.name,
      r.type,
      r.resourceGroup,
      r.reason,
      formatMoney(r.estimatedMonthlyCost, r.currency),
    ]);

    const totalCost = resources.reduce((sum, r) => sum + r.estimatedMonthlyCost, 0);
    const currency = resources[0]?.currency ?? 'USD';

    const table = formatTable({
      headers: ['#', 'Resource', 'Type', 'Resource Group', 'Reason', 'Est. Monthly Cost'],
      rows,
      alignRight: [0, 5],
    });

    const lines = [
      `Idle Resources (${resources.length} found)`,
      '',
      table,
      '',
      `Estimated total monthly waste: ${formatMoney(totalCost, currency)}`,
    ];

    return toolResult(lines.join('\n'));
  });
}
