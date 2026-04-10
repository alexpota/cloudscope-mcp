import { describe, it, expect, vi } from 'vitest';
import { handleCrossSubscriptionCosts } from '../../src/tools/cross-subscription-costs.js';
import type { SubscriptionInfo } from '../../src/providers/azure/discovery.js';
import type { CostQueryResult } from '../../src/providers/types.js';

const subs: SubscriptionInfo[] = [
  { id: 'sub-1', name: 'Production', state: 'Enabled' },
  { id: 'sub-2', name: 'Development', state: 'Enabled' },
  { id: 'sub-3', name: 'Staging', state: 'Enabled' },
];

function makeDeps(
  mockFn: (scope: string, start: string, end: string, grouping: string) => Promise<CostQueryResult>,
) {
  return { queryCostsForScope: vi.fn(mockFn) };
}

describe('handleCrossSubscriptionCosts', () => {
  it('returns merged cost table grouped by subscription', async () => {
    const deps = makeDeps(async (scope) => ({
      rows: [{ name: 'Redis', cost: scope.includes('sub-1') ? 500 : 100 }],
      currency: 'USD',
    }));

    const result = await handleCrossSubscriptionCosts(
      { provider: 'azure' as const },
      deps,
      subs,
    );

    const text = result.content[0].text;
    expect(text).toContain('Production');
    expect(text).toContain('Development');
    expect(text).toContain('Staging');
    expect(text).toContain('$500.00');
    expect(text).toContain('$100.00');
    expect(result.isError).toBeUndefined();
  });

  it('queries only specified subscription_ids when provided', async () => {
    const deps = makeDeps(async () => ({
      rows: [{ name: 'VM', cost: 200 }],
      currency: 'USD',
    }));

    await handleCrossSubscriptionCosts(
      { provider: 'azure' as const, subscription_ids: ['sub-1', 'sub-3'] },
      deps,
      subs,
    );

    expect(deps.queryCostsForScope).toHaveBeenCalledTimes(2);
    const scopes = deps.queryCostsForScope.mock.calls.map((c) => c[0]);
    expect(scopes).toContain('/subscriptions/sub-1');
    expect(scopes).toContain('/subscriptions/sub-3');
    expect(scopes).not.toContain('/subscriptions/sub-2');
  });

  it('handles partial failures — returns successes with a warning', async () => {
    const deps = makeDeps(async (scope) => {
      if (scope.includes('sub-2')) throw new Error('permission denied');
      return { rows: [{ name: 'VM', cost: 300 }], currency: 'USD' };
    });

    const result = await handleCrossSubscriptionCosts(
      { provider: 'azure' as const },
      deps,
      subs,
    );

    const text = result.content[0].text;
    expect(text).toContain('Production');
    expect(text).toContain('Staging');
    expect(text).toContain('Development');
    expect(text).toContain('permission denied');
    expect(result.isError).toBeUndefined();
  });

  it('returns error when ALL subscriptions fail', async () => {
    const deps = makeDeps(async () => {
      throw new Error('throttled');
    });

    const result = await handleCrossSubscriptionCosts(
      { provider: 'azure' as const },
      deps,
      subs,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('throttled');
  });

  it('defaults to all enabled subscriptions when subscription_ids is omitted', async () => {
    const deps = makeDeps(async () => ({
      rows: [{ name: 'VM', cost: 100 }],
      currency: 'USD',
    }));

    await handleCrossSubscriptionCosts(
      { provider: 'azure' as const },
      deps,
      subs,
    );

    expect(deps.queryCostsForScope).toHaveBeenCalledTimes(3);
  });

  it('returns error when no subscriptions are available', async () => {
    const deps = makeDeps(async () => ({ rows: [], currency: 'USD' }));

    const result = await handleCrossSubscriptionCosts(
      { provider: 'azure' as const },
      deps,
      [],
    );

    expect(result.isError).toBe(true);
  });
});
