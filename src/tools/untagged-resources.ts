import { formatTable } from '../utils/formatter.js';
import { toolResult, withProvider, type ToolResult, type Providers } from './types.js';

interface UntaggedResourcesInput {
  provider: 'azure';
}

export async function handleFindUntaggedResources(
  input: UntaggedResourcesInput,
  providers: Providers,
): Promise<ToolResult> {
  return withProvider(providers, input.provider, async (provider) => {
    const resources = await provider.findUntaggedResources();

    if (resources.length === 0) {
      return toolResult('All resources have tags applied. No tagging gaps found.');
    }

    const rows = resources.map((r) => [r.name, r.type, r.resourceGroup, r.location]);

    const table = formatTable({
      headers: ['Resource', 'Type', 'Resource Group', 'Location'],
      rows,
      alignRight: [],
    });

    const lines = [
      `Untagged Resources (${resources.length} found)`,
      '',
      table,
    ];

    return toolResult(lines.join('\n'));
  });
}
