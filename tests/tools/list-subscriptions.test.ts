import { describe, it, expect } from 'vitest';
import { handleListSubscriptions } from '../../src/tools/list-subscriptions.js';
import type { SubscriptionInfo } from '../../src/providers/azure/discovery.js';

describe('handleListSubscriptions', () => {
  const sampleSubs: SubscriptionInfo[] = [
    { id: 'sub-1', name: 'Production', state: 'Enabled' },
    { id: 'sub-2', name: 'Development', state: 'Enabled' },
    { id: 'sub-3', name: 'Old Project', state: 'Disabled' },
  ];

  it('returns a formatted table with all subscriptions', () => {
    const result = handleListSubscriptions(sampleSubs, 'sub-1');
    const text = result.content[0].text;

    expect(text).toContain('3 found');
    expect(text).toContain('Production');
    expect(text).toContain('Development');
    expect(text).toContain('Old Project');
    expect(text).toContain('sub-1');
    expect(text).toContain('sub-2');
    expect(text).toContain('sub-3');
  });

  it('marks the active subscription', () => {
    const result = handleListSubscriptions(sampleSubs, 'sub-1');
    const text = result.content[0].text;

    expect(text).toContain('Production (active)');
    expect(text).not.toContain('Development (active)');
  });

  it('shows state for each subscription', () => {
    const result = handleListSubscriptions(sampleSubs, 'sub-1');
    const text = result.content[0].text;

    expect(text).toContain('Enabled');
    expect(text).toContain('Disabled');
  });

  it('returns an error when no subscriptions are found', () => {
    const result = handleListSubscriptions([], 'sub-1');

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No Azure subscriptions found');
  });
});
