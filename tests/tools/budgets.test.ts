import { describe, it, expect, vi } from 'vitest';
import { handleCheckBudgets } from '../../src/tools/budgets.js';

const mockAzureClient = {
  listBudgets: vi.fn(),
};

describe('handleCheckBudgets', () => {
  it('returns formatted budget table', async () => {
    mockAzureClient.listBudgets.mockResolvedValueOnce([
      {
        name: 'Production',
        amount: 10000,
        timeGrain: 'Monthly',
        currentSpend: 7500,
        forecastSpend: 11000,
        currency: 'USD',
      },
      {
        name: 'Development',
        amount: 2000,
        timeGrain: 'Monthly',
        currentSpend: 800,
        forecastSpend: 1200,
        currency: 'USD',
      },
    ]);

    const result = await handleCheckBudgets(
      { provider: 'azure' },
      { azure: mockAzureClient as any },
    );

    const text = result.content[0].text;
    expect(text).toContain('Production');
    expect(text).toContain('Development');
    expect(text).toContain('$10,000.00');
    expect(text).toContain('$7,500.00');
    expect(text).toContain('OVER'); // Production forecast > limit
    expect(text).toContain('OK'); // Development is fine
    expect(text).toContain('2 budget(s)');
  });

  it('shows projected overage when forecast exceeds total budget', async () => {
    mockAzureClient.listBudgets.mockResolvedValueOnce([
      {
        name: 'Main',
        amount: 5000,
        timeGrain: 'Monthly',
        currentSpend: 4000,
        forecastSpend: 6000,
        currency: 'USD',
      },
    ]);

    const result = await handleCheckBudgets(
      { provider: 'azure' },
      { azure: mockAzureClient as any },
    );

    const text = result.content[0].text;
    expect(text).toContain('Projected overage');
    expect(text).toContain('$1,000.00');
  });

  it('returns message when no budgets exist', async () => {
    mockAzureClient.listBudgets.mockResolvedValueOnce([]);

    const result = await handleCheckBudgets(
      { provider: 'azure' },
      { azure: mockAzureClient as any },
    );

    expect(result.content[0].text).toContain('No budgets found');
  });

  it('returns error when not configured', async () => {
    const result = await handleCheckBudgets(
      { provider: 'azure' },
      { azure: null },
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not configured');
  });
});
