import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: vi.fn(),
  ClientSecretCredential: vi.fn(),
}));

const mockSubscriptionsList = vi.fn();

vi.mock('@azure/arm-resources-subscriptions', () => ({
  SubscriptionClient: vi.fn().mockImplementation(() => ({
    subscriptions: {
      list: mockSubscriptionsList,
    },
  })),
}));

describe('Azure subscription discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listAzureSubscriptions', () => {
    it('returns all subscriptions with id, name, and state', async () => {
      mockSubscriptionsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            subscriptionId: 'sub-1',
            displayName: 'Production',
            state: 'Enabled',
          };
          yield {
            subscriptionId: 'sub-2',
            displayName: 'Development',
            state: 'Enabled',
          };
          yield {
            subscriptionId: 'sub-3',
            displayName: 'Old Project',
            state: 'Disabled',
          };
        },
      });

      const { listAzureSubscriptions } = await import(
        '../../../src/providers/azure/discovery.js'
      );
      const credential = {} as any;
      const subs = await listAzureSubscriptions(credential);

      expect(subs).toHaveLength(3);
      expect(subs[0]).toEqual({ id: 'sub-1', name: 'Production', state: 'Enabled' });
      expect(subs[1]).toEqual({ id: 'sub-2', name: 'Development', state: 'Enabled' });
      expect(subs[2]).toEqual({ id: 'sub-3', name: 'Old Project', state: 'Disabled' });
    });

    it('handles subscriptions with missing fields gracefully', async () => {
      mockSubscriptionsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {};
        },
      });

      const { listAzureSubscriptions } = await import(
        '../../../src/providers/azure/discovery.js'
      );
      const subs = await listAzureSubscriptions({} as any);

      expect(subs).toHaveLength(1);
      expect(subs[0]).toEqual({ id: '', name: '', state: 'Unknown' });
    });

    it('returns empty array when no subscriptions exist', async () => {
      mockSubscriptionsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      });

      const { listAzureSubscriptions } = await import(
        '../../../src/providers/azure/discovery.js'
      );
      const subs = await listAzureSubscriptions({} as any);

      expect(subs).toHaveLength(0);
    });
  });

  describe('discoverSubscriptionId', () => {
    it('returns the first Enabled subscription ID', async () => {
      mockSubscriptionsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { subscriptionId: 'sub-disabled', displayName: 'Old', state: 'Disabled' };
          yield { subscriptionId: 'sub-enabled', displayName: 'Active', state: 'Enabled' };
        },
      });

      const { discoverSubscriptionId } = await import(
        '../../../src/providers/azure/discovery.js'
      );
      const id = await discoverSubscriptionId({} as any);

      expect(id).toBe('sub-enabled');
    });

    it('throws when no Enabled subscriptions are found', async () => {
      mockSubscriptionsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { subscriptionId: 'sub-1', displayName: 'Old', state: 'Disabled' };
        },
      });

      const { discoverSubscriptionId } = await import(
        '../../../src/providers/azure/discovery.js'
      );

      await expect(discoverSubscriptionId({} as any)).rejects.toThrow(
        'No enabled Azure subscriptions found',
      );
    });

    it('throws when no subscriptions exist at all', async () => {
      mockSubscriptionsList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      });

      const { discoverSubscriptionId } = await import(
        '../../../src/providers/azure/discovery.js'
      );

      await expect(discoverSubscriptionId({} as any)).rejects.toThrow(
        'No enabled Azure subscriptions found',
      );
    });
  });
});
