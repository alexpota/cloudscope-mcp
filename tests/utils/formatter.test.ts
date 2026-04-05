import { describe, it, expect } from 'vitest';
import { formatCostTable } from '../../src/utils/formatter.js';

describe('formatCostTable', () => {
  it('formats cost rows into a text table sorted by cost descending', () => {
    const result = formatCostTable({
      title: 'Azure Cost Summary (2026-03-01 to 2026-03-31)',
      subtitle: 'Subscription: Production',
      groupLabel: 'Service',
      rows: [
        { name: 'Virtual Machines', cost: 4231.5 },
        { name: 'Storage Accounts', cost: 1050.75 },
        { name: 'Azure SQL Database', cost: 2100.0 },
      ],
      currency: 'USD',
      periodDays: 31,
    });

    expect(result).toContain('Azure Cost Summary');
    expect(result).toContain('Virtual Machines');
    expect(result).toContain('$4,231.50');
    expect(result).toContain('TOTAL');
    expect(result).toContain('$7,382.25');
    // Should be sorted by cost descending
    const vmIndex = result.indexOf('Virtual Machines');
    const sqlIndex = result.indexOf('Azure SQL Database');
    const storageIndex = result.indexOf('Storage Accounts');
    expect(vmIndex).toBeLessThan(sqlIndex);
    expect(sqlIndex).toBeLessThan(storageIndex);
  });

  it('collapses tail items when more than 10 rows', () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      name: `Service ${i}`,
      cost: 100 - i,
    }));
    const result = formatCostTable({
      title: 'Test',
      groupLabel: 'Service',
      rows,
      currency: 'USD',
    });

    expect(result).toContain('Other (5 services)');
  });

  it('includes daily average when periodDays is provided', () => {
    const result = formatCostTable({
      title: 'Test',
      groupLabel: 'Service',
      rows: [{ name: 'Compute', cost: 310.0 }],
      currency: 'USD',
      periodDays: 31,
    });
    expect(result).toContain('Daily average: $10.00');
  });
});
