import { describe, it, expect } from 'vitest';
import { linearForecast } from '../../src/utils/forecast.js';

describe('linearForecast', () => {
  it('returns empty array with fewer than 2 data points', () => {
    expect(linearForecast([], 7)).toEqual([]);
    expect(linearForecast([{ date: '2026-04-01', cost: 100 }], 7)).toEqual([]);
  });

  it('returns empty array with zero forecast days', () => {
    const data = [
      { date: '2026-04-01', cost: 100 },
      { date: '2026-04-02', cost: 110 },
    ];
    expect(linearForecast(data, 0)).toEqual([]);
  });

  it('produces actual rows followed by forecast rows', () => {
    const data = [
      { date: '2026-04-01', cost: 100 },
      { date: '2026-04-02', cost: 120 },
      { date: '2026-04-03', cost: 140 },
    ];

    const result = linearForecast(data, 2);

    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ date: '2026-04-01', cost: 100, costType: 'Actual' });
    expect(result[1]).toEqual({ date: '2026-04-02', cost: 120, costType: 'Actual' });
    expect(result[2]).toEqual({ date: '2026-04-03', cost: 140, costType: 'Actual' });
    expect(result[3]?.costType).toBe('Forecast');
    expect(result[3]?.date).toBe('2026-04-04');
    expect(result[4]?.costType).toBe('Forecast');
    expect(result[4]?.date).toBe('2026-04-05');
  });

  it('computes correct linear trend for steady increase', () => {
    // y = 10x + 100 → slope=10, intercept=100
    const data = [
      { date: '2026-04-01', cost: 100 },
      { date: '2026-04-02', cost: 110 },
      { date: '2026-04-03', cost: 120 },
    ];

    const result = linearForecast(data, 2);

    // Day 3 (index 3): 10*3 + 100 = 130
    expect(result[3]?.cost).toBeCloseTo(130, 2);
    // Day 4 (index 4): 10*4 + 100 = 140
    expect(result[4]?.cost).toBeCloseTo(140, 2);
  });

  it('clamps negative forecast values to zero', () => {
    // Steep downward trend that would go negative
    const data = [
      { date: '2026-04-01', cost: 20 },
      { date: '2026-04-02', cost: 10 },
      { date: '2026-04-03', cost: 0 },
    ];

    const result = linearForecast(data, 3);

    // All forecast costs should be >= 0
    const forecasts = result.filter((r) => r.costType === 'Forecast');
    for (const f of forecasts) {
      expect(f.cost).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles flat costs (zero slope)', () => {
    const data = [
      { date: '2026-04-01', cost: 50 },
      { date: '2026-04-02', cost: 50 },
      { date: '2026-04-03', cost: 50 },
    ];

    const result = linearForecast(data, 2);
    const forecasts = result.filter((r) => r.costType === 'Forecast');

    expect(forecasts[0]?.cost).toBeCloseTo(50, 2);
    expect(forecasts[1]?.cost).toBeCloseTo(50, 2);
  });

  it('sorts unsorted input by date', () => {
    const data = [
      { date: '2026-04-03', cost: 140 },
      { date: '2026-04-01', cost: 100 },
      { date: '2026-04-02', cost: 120 },
    ];

    const result = linearForecast(data, 1);

    expect(result[0]?.date).toBe('2026-04-01');
    expect(result[1]?.date).toBe('2026-04-02');
    expect(result[2]?.date).toBe('2026-04-03');
    expect(result[3]?.date).toBe('2026-04-04');
  });

  it('handles two data points (minimum)', () => {
    const data = [
      { date: '2026-04-01', cost: 100 },
      { date: '2026-04-02', cost: 200 },
    ];

    const result = linearForecast(data, 1);

    expect(result).toHaveLength(3);
    // slope=100, intercept=100 → day 2: 100*2 + 100 = 300
    expect(result[2]?.cost).toBeCloseTo(300, 2);
    expect(result[2]?.costType).toBe('Forecast');
  });
});
