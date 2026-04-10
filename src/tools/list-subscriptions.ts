import { formatTable } from '../utils/formatter.js';
import { toolResult, toolError, type ToolResult } from './types.js';
import type { SubscriptionInfo } from '../providers/azure/discovery.js';

export function handleListSubscriptions(
  subscriptions: SubscriptionInfo[],
  activeSubscriptionId: string,
): ToolResult {
  if (subscriptions.length === 0) {
    return toolError(new Error('No Azure subscriptions found for the current credential.'));
  }

  const rows = subscriptions.map((s) => [
    s.id === activeSubscriptionId ? `${s.name} (active)` : s.name,
    s.id,
    s.state,
  ]);

  const table = formatTable({
    headers: ['Subscription', 'ID', 'State'],
    rows,
    alignRight: [],
  });

  const lines = [
    `Azure Subscriptions (${subscriptions.length} found)`,
    '',
    table,
  ];

  return toolResult(lines.join('\n'));
}
