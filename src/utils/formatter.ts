export interface CostRow {
  name: string;
  cost: number;
}

export interface CostTableOptions {
  title: string;
  subtitle?: string;
  groupLabel: string;
  rows: CostRow[];
  currency: string;
  periodDays?: number;
}

export function formatCostTable(options: CostTableOptions): string {
  const { title, subtitle, groupLabel, rows, currency, periodDays } = options;

  // Sort by cost descending
  const sorted = [...rows].sort((a, b) => b.cost - a.cost);

  // Collapse tail if > 10 rows
  let displayRows: CostRow[];
  if (sorted.length > 10) {
    const top = sorted.slice(0, 10);
    const tail = sorted.slice(10);
    const tailCost = tail.reduce((sum, r) => sum + r.cost, 0);
    displayRows = [
      ...top,
      { name: `Other (${tail.length} services)`, cost: tailCost },
    ];
  } else {
    displayRows = sorted;
  }

  const total = sorted.reduce((sum, r) => sum + r.cost, 0);

  // Calculate column widths
  const nameWidth = Math.max(
    groupLabel.length,
    ...displayRows.map((r) => r.name.length),
  );
  const costHeader = `Cost (${currency})`;
  const costWidth = Math.max(
    costHeader.length,
    ...displayRows.map((r) => formatMoney(r.cost, currency).length),
  );

  const lines: string[] = [];

  lines.push(title);
  if (subtitle) lines.push(subtitle);
  lines.push('');

  // Header
  const header = `${groupLabel.padEnd(nameWidth)} | ${costHeader.padStart(costWidth)} | % of Total`;
  lines.push(header);
  const separator = `${'-'.repeat(nameWidth)}-|-${'-'.repeat(costWidth)}-|----------`;
  lines.push(separator);

  // Data rows
  for (const row of displayRows) {
    const pct = total > 0 ? ((row.cost / total) * 100).toFixed(1) : '0.0';
    const line = `${row.name.padEnd(nameWidth)} | ${formatMoney(row.cost, currency).padStart(costWidth)} | ${pct.padStart(5)}%`;
    lines.push(line);
  }

  // Total
  lines.push(separator);
  const totalLine = `${'TOTAL'.padEnd(nameWidth)} | ${formatMoney(total, currency).padStart(costWidth)} | 100.0%`;
  lines.push(totalLine);

  // Footer
  if (periodDays) {
    const dailyAvg = total / periodDays;
    lines.push('');
    lines.push(
      `Period: ${periodDays} days | Daily average: ${formatMoney(dailyAvg, currency)}`,
    );
  }

  return lines.join('\n');
}

export function formatMoney(amount: number, currency: string): string {
  const symbol = currency === 'USD' ? '$' : currency;
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatChange(current: number, previous: number): string {
  const diff = current - previous;
  const pctChange =
    previous > 0 ? ((diff / previous) * 100).toFixed(1) : 'N/A';
  const direction = diff > 0 ? '+' : '';
  return `${direction}${formatMoney(diff, 'USD')} (${direction}${pctChange}%)`;
}
