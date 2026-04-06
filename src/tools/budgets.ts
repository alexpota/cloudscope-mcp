import { formatMoney } from '../utils/formatter.js';
import { ProviderNotConfiguredError } from '../utils/errors.js';
import type { Providers } from './cost-summary.js';
import { toolResult, toolError, type ToolResult } from './types.js';

interface BudgetsInput {
  provider: 'azure';
}

export async function handleCheckBudgets(
  _input: BudgetsInput,
  providers: Providers,
): Promise<ToolResult> {
  try {
    if (!providers.azure) throw new ProviderNotConfiguredError();

    const budgets = await providers.azure.listBudgets();

    if (budgets.length === 0) {
      return toolResult(
        'No budgets found for this Azure subscription.\n\nCreate budgets in the Azure portal under Cost Management > Budgets.',
      );
    }

    const lines: string[] = [];
    lines.push(`Azure Budget Status (${budgets.length} budget(s))`);
    lines.push('');
    lines.push(
      `${'Budget'.padEnd(25)} | ${'Limit'.padStart(12)} | ${'Spent'.padStart(12)} | ${'%Used'.padStart(6)} | ${'Forecast'.padStart(12)} | Risk`,
    );
    lines.push(
      `${'-'.repeat(25)}-|-${'-'.repeat(12)}-|-${'-'.repeat(12)}-|-${'-'.repeat(6)}-|-${'-'.repeat(12)}-|---------`,
    );

    for (const b of budgets) {
      const pctUsed = b.amount > 0 ? (b.currentSpend / b.amount) * 100 : 0;
      const pctForecast = b.amount > 0 ? (b.forecastSpend / b.amount) * 100 : 0;
      const risk =
        pctForecast > 100 ? 'OVER' : pctForecast > 90 ? 'HIGH' : pctUsed > 80 ? 'WARN' : 'OK';

      lines.push(
        `${b.name.padEnd(25)} | ${formatMoney(b.amount, b.currency).padStart(12)} | ${formatMoney(b.currentSpend, b.currency).padStart(12)} | ${pctUsed.toFixed(1).padStart(5)}% | ${formatMoney(b.forecastSpend, b.currency).padStart(12)} | ${risk}`,
      );
    }

    const totalLimit = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.currentSpend, 0);
    const totalForecast = budgets.reduce((sum, b) => sum + b.forecastSpend, 0);
    const currency = budgets[0]?.currency || 'USD';

    lines.push('');
    lines.push(`Total budget: ${formatMoney(totalLimit, currency)}`);
    lines.push(`Total spent: ${formatMoney(totalSpent, currency)}`);
    lines.push(`Total forecast: ${formatMoney(totalForecast, currency)}`);

    if (totalForecast > totalLimit) {
      lines.push(`Projected overage: ${formatMoney(totalForecast - totalLimit, currency)}`);
    }

    return toolResult(lines.join('\n'));
  } catch (error) {
    return toolError(error);
  }
}
