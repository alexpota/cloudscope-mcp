import { formatMoney, formatTable } from '../utils/formatter.js';
import { toolResult, toolError, type ToolResult } from './types.js';
import { firstOfCurrentMonth, todayYMD, validateDateRange } from '../utils/dates.js';
import type { SubscriptionInfo } from '../providers/azure/discovery.js';
import type { CostQueryResult } from '../providers/types.js';
import { DEFAULT_CURRENCY } from '../constants.js';

interface CrossSubscriptionInput {
  provider: 'azure';
  subscription_ids?: string[];
  start_date?: string;
  end_date?: string;
}

interface CrossSubscriptionDeps {
  queryCostsForScope: (
    scope: string,
    startDate: string,
    endDate: string,
    grouping: string,
  ) => Promise<CostQueryResult>;
}

export async function handleCrossSubscriptionCosts(
  input: CrossSubscriptionInput,
  deps: CrossSubscriptionDeps,
  subscriptions: SubscriptionInfo[],
): Promise<ToolResult> {
  if (subscriptions.length === 0) {
    return toolError(new Error('No Azure subscriptions available.'));
  }

  const startDate = input.start_date || firstOfCurrentMonth();
  const endDate = input.end_date || todayYMD();

  const dateError = validateDateRange(startDate, endDate);
  if (dateError) return toolError(new Error(dateError));

  const targetSubs = input.subscription_ids
    ? subscriptions.filter((s) => input.subscription_ids?.includes(s.id))
    : subscriptions.filter((s) => s.state === 'Enabled');

  if (targetSubs.length === 0) {
    return toolError(new Error('No matching subscriptions found for the provided IDs.'));
  }

  const results: Array<{ sub: SubscriptionInfo; cost: number; currency: string }> = [];
  const failures: Array<{ sub: SubscriptionInfo; error: string }> = [];

  await Promise.all(
    targetSubs.map(async (sub) => {
      try {
        const scope = `/subscriptions/${sub.id}`;
        const data = await deps.queryCostsForScope(scope, startDate, endDate, 'ServiceName');
        const total = data.rows.reduce((sum, r) => sum + r.cost, 0);
        results.push({ sub, cost: total, currency: data.currency || DEFAULT_CURRENCY });
      } catch {
        failures.push({ sub, error: 'access denied or query failed' });
      }
    }),
  );

  if (results.length === 0) {
    return toolError(
      new Error(
        `All ${failures.length} subscription(s) failed. Verify credentials have Cost Management Reader role on each subscription.`,
      ),
    );
  }

  results.sort((a, b) => b.cost - a.cost);
  const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
  const currency = results[0]?.currency || DEFAULT_CURRENCY;

  const rows = results.map((r) => [
    r.sub.name,
    formatMoney(r.cost, r.currency),
    totalCost > 0 ? `${((r.cost / totalCost) * 100).toFixed(1)}%` : '0.0%',
  ]);

  rows.push(['TOTAL', formatMoney(totalCost, currency), '100.0%']);

  const table = formatTable({
    headers: ['Subscription', `Cost (${currency})`, '% of Total'],
    rows,
    alignRight: [1, 2],
  });

  const lines = [
    `Cross-Subscription Cost Summary (${startDate} to ${endDate})`,
    '',
    table,
  ];

  if (failures.length > 0) {
    lines.push('');
    lines.push(`Warning: ${failures.length} subscription(s) failed:`);
    for (const f of failures) {
      lines.push(`  - ${f.sub.name} (${f.sub.id}): ${f.error}`);
    }
  }

  return toolResult(lines.join('\n'));
}
