import { describe, it, expect } from 'vitest';
import { formatCostTable } from '../../src/utils/formatter.js';

describe('formatCostTable stress and edge cases', () => {
  it('handles empty rows (zero cost scenario)', () => {
    const result = formatCostTable({
      title: 'Empty Report',
      groupLabel: 'Service',
      rows: [],
      currency: 'USD',
    });

    expect(result).toContain('Empty Report');
    expect(result).toContain('TOTAL');
    expect(result).toContain('$0.00');
  });

  it('handles single row', () => {
    const result = formatCostTable({
      title: 'Single',
      groupLabel: 'Service',
      rows: [{ name: 'Only Service', cost: 42.50 }],
      currency: 'USD',
    });

    expect(result).toContain('Only Service');
    expect(result).toContain('$42.50');
    expect(result).toContain('100.0%');
  });

  it('collapses 1000+ rows into top 10 + Other', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      name: `Service-${String(i).padStart(4, '0')}`,
      cost: 1000 - i * 0.5,
    }));

    const result = formatCostTable({
      title: 'Massive Report',
      groupLabel: 'Service',
      rows,
      currency: 'USD',
    });

    // Should have top 10 + "Other (990 services)" + TOTAL
    expect(result).toContain('Other (990 services)');
    expect(result).toContain('Service-0000'); // highest cost
    expect(result).toContain('Service-0009'); // 10th highest
    expect(result).not.toContain('Service-0010'); // 11th should be in Other
    expect(result).toContain('TOTAL');
  });

  it('handles exactly 10 rows without collapsing', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      name: `Service-${i}`,
      cost: 100 - i,
    }));

    const result = formatCostTable({
      title: 'Ten Services',
      groupLabel: 'Service',
      rows,
      currency: 'USD',
    });

    expect(result).not.toContain('Other');
    // All 10 should be listed
    for (let i = 0; i < 10; i++) {
      expect(result).toContain(`Service-${i}`);
    }
  });

  it('handles exactly 11 rows — collapses 1 into Other', () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({
      name: `Svc-${i}`,
      cost: 110 - i * 10,
    }));

    const result = formatCostTable({
      title: 'Eleven',
      groupLabel: 'Service',
      rows,
      currency: 'USD',
    });

    expect(result).toContain('Other (1 services)');
  });

  it('handles rows with zero cost', () => {
    const result = formatCostTable({
      title: 'Zero Cost',
      groupLabel: 'Service',
      rows: [
        { name: 'Free Tier', cost: 0 },
        { name: 'Paid', cost: 50 },
      ],
      currency: 'USD',
    });

    expect(result).toContain('Free Tier');
    expect(result).toContain('$0.00');
    expect(result).toContain('0.0%');
  });

  it('handles very large cost values', () => {
    const result = formatCostTable({
      title: 'Big Spender',
      groupLabel: 'Service',
      rows: [{ name: 'Enterprise DB', cost: 1234567.89 }],
      currency: 'USD',
    });

    expect(result).toContain('$1,234,567.89');
  });

  it('handles very small cost values', () => {
    const result = formatCostTable({
      title: 'Micro',
      groupLabel: 'Service',
      rows: [{ name: 'Lambda', cost: 0.01 }],
      currency: 'USD',
    });

    expect(result).toContain('$0.01');
  });
});
