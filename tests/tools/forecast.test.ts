import { describe, it, expect, vi } from 'vitest';
import { handleGetCostForecast } from '../../src/tools/forecast.js';

const mockAzureClient = {
  forecastCosts: vi.fn(),
};

describe('handleGetCostForecast', () => {
  it('returns formatted forecast with actual and projected costs', async () => {
    mockAzureClient.forecastCosts.mockResolvedValueOnce({
      rows: [
        { date: '20260401', cost: 100, costType: 'Actual', currency: 'USD' },
        { date: '20260402', cost: 110, costType: 'Actual', currency: 'USD' },
        { date: '20260403', cost: 95, costType: 'Forecast', currency: 'USD' },
        { date: '20260404', cost: 105, costType: 'Forecast', currency: 'USD' },
      ],
      currency: 'USD',
    });

    const result = await handleGetCostForecast(
      { provider: 'azure', days: 30 },
      { azure: mockAzureClient as any, gcp: null },
    );

    const text = result.content[0].text;
    expect(text).toContain('Cost Forecast');
    expect(text).toContain('Accrued to date:');
    expect(text).toContain('$210.00');
    expect(text).toContain('Forecasted remaining:');
    expect(text).toContain('$200.00');
    expect(text).toContain('Projected total:');
    expect(text).toContain('$410.00');
    expect(text).toContain('Projected daily average:');
  });

  it('shows daily breakdown sorted by date', async () => {
    mockAzureClient.forecastCosts.mockResolvedValueOnce({
      rows: [
        { date: '20260403', cost: 95, costType: 'Forecast', currency: 'USD' },
        { date: '20260401', cost: 100, costType: 'Actual', currency: 'USD' },
        { date: '20260402', cost: 110, costType: 'Actual', currency: 'USD' },
      ],
      currency: 'USD',
    });

    const result = await handleGetCostForecast(
      { provider: 'azure', days: 30 },
      { azure: mockAzureClient as any, gcp: null },
    );

    const text = result.content[0].text;
    const idx1 = text.indexOf('2026-04-01');
    const idx2 = text.indexOf('2026-04-02');
    const idx3 = text.indexOf('2026-04-03');
    expect(idx1).toBeLessThan(idx2);
    expect(idx2).toBeLessThan(idx3);
    expect(text).toContain('Actual');
    expect(text).toContain('Forecast');
  });

  it('handles empty forecast result', async () => {
    mockAzureClient.forecastCosts.mockResolvedValueOnce({
      rows: [],
      currency: 'USD',
    });

    const result = await handleGetCostForecast(
      { provider: 'azure', days: 30 },
      { azure: mockAzureClient as any, gcp: null },
    );

    const text = result.content[0].text;
    expect(text).toContain('Projected total:');
    expect(text).toContain('$0.00');
  });

  it('returns error when provider not configured', async () => {
    const result = await handleGetCostForecast(
      { provider: 'azure', days: 30 },
      { azure: null, gcp: null },
    );

    expect(result.content[0].text).toContain('not configured');
    expect(result.isError).toBe(true);
  });
});
