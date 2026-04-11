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
      { azure: mockAzureClient as any, gcp: null },
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

  it('marks a budget as OVER when its own forecast exceeds its own limit', async () => {
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
      { azure: mockAzureClient as any, gcp: null },
    );

    const text = result.content[0].text;
    expect(text).toContain('Main');
    expect(text).toContain('OVER');
  });

  it('does not sum currentSpend across multiple budgets (avoids double-counting overlapping scopes)', async () => {
    // Two budgets tracking the same subscription each report $0.31; summing
    // them would produce a phantom $0.62. Reproduces the real-world bug.
    mockAzureClient.listBudgets.mockResolvedValueOnce([
      {
        name: 'test-budget',
        amount: 10,
        timeGrain: 'Monthly',
        currentSpend: 0.31,
        forecastSpend: 0,
        currency: 'USD',
      },
      {
        name: 'production-budget',
        amount: 200,
        timeGrain: 'Monthly',
        currentSpend: 0.31,
        forecastSpend: 0,
        currency: 'USD',
      },
    ]);

    const result = await handleCheckBudgets(
      { provider: 'azure' },
      { azure: mockAzureClient as any, gcp: null },
    );

    const text = result.content[0].text;

    expect(text).toContain('test-budget');
    expect(text).toContain('production-budget');
    expect(text).toContain('$0.31');
    expect(text).not.toContain('$0.62');
    expect(text).not.toMatch(/Total spent/);
    expect(text).not.toMatch(/Total forecast/);
  });

  it('returns message when no budgets exist', async () => {
    mockAzureClient.listBudgets.mockResolvedValueOnce([]);

    const result = await handleCheckBudgets(
      { provider: 'azure' },
      { azure: mockAzureClient as any, gcp: null },
    );

    expect(result.content[0].text).toContain('No budgets found');
  });

  it('returns error when not configured', async () => {
    const result = await handleCheckBudgets(
      { provider: 'azure' },
      { azure: null, gcp: null },
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not configured');
  });
});
