import { describe, it, expect, vi } from 'vitest';
import { handleComparePeriods } from '../../src/tools/compare.js';

const mockAzureClient = {
  queryCosts: vi.fn(),
};

describe('handleComparePeriods', () => {
  it('shows side-by-side comparison with changes', async () => {
    mockAzureClient.queryCosts
      .mockResolvedValueOnce({
        rows: [
          { serviceName: 'VMs', cost: 1000, currency: 'USD' },
          { serviceName: 'Storage', cost: 500, currency: 'USD' },
        ],
        currency: 'USD',
      })
      .mockResolvedValueOnce({
        rows: [
          { serviceName: 'VMs', cost: 1500, currency: 'USD' },
          { serviceName: 'Storage', cost: 400, currency: 'USD' },
        ],
        currency: 'USD',
      });

    const result = await handleComparePeriods(
      {
        provider: 'azure',
        period_a_start: '2026-01-01',
        period_a_end: '2026-01-31',
        period_b_start: '2026-02-01',
        period_b_end: '2026-02-28',
        group_by: 'service',
      },
      { azure: mockAzureClient as any },
    );

    const text = result.content[0].text;
    expect(text).toContain('Cost Comparison');
    expect(text).toContain('VMs');
    expect(text).toContain('Storage');
    expect(text).toContain('+50.0%'); // VMs: 1000 -> 1500
    expect(text).toContain('-20.0%'); // Storage: 500 -> 400
    expect(text).toContain('TOTAL');
    expect(text).toContain('Net change');
  });

  it('handles services that exist in only one period', async () => {
    mockAzureClient.queryCosts
      .mockResolvedValueOnce({
        rows: [{ serviceName: 'OldService', cost: 300, currency: 'USD' }],
        currency: 'USD',
      })
      .mockResolvedValueOnce({
        rows: [{ serviceName: 'NewService', cost: 200, currency: 'USD' }],
        currency: 'USD',
      });

    const result = await handleComparePeriods(
      {
        provider: 'azure',
        period_a_start: '2026-01-01',
        period_a_end: '2026-01-31',
        period_b_start: '2026-02-01',
        period_b_end: '2026-02-28',
        group_by: 'service',
      },
      { azure: mockAzureClient as any },
    );

    const text = result.content[0].text;
    expect(text).toContain('OldService');
    expect(text).toContain('NewService');
  });

  it('returns error when not configured', async () => {
    const result = await handleComparePeriods(
      {
        provider: 'azure',
        period_a_start: '2026-01-01',
        period_a_end: '2026-01-31',
        period_b_start: '2026-02-01',
        period_b_end: '2026-02-28',
        group_by: 'service',
      },
      { azure: null },
    );

    expect(result.isError).toBe(true);
  });
});
