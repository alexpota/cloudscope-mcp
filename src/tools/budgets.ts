import { formatMoney, formatTable } from '../utils/formatter.js';
import { toolResult, withProvider, type ToolResult, type Providers } from './types.js';
import {
  BUDGET_RISK_OVER_THRESHOLD,
  BUDGET_RISK_HIGH_THRESHOLD,
  BUDGET_RISK_WARN_THRESHOLD,
  BUDGET_RISK_LABELS,
  DEFAULT_CURRENCY,
} from '../constants.js';

interface BudgetsInput {
  provider: 'azure';
}

export async function handleCheckBudgets(
  input: BudgetsInput,
  providers: Providers,
): Promise<ToolResult> {
  return withProvider(providers, input.provider, async (provider) => {
    const budgets = await provider.listBudgets();

    if (budgets.length === 0) {
      return toolResult(
        'No budgets found.\n\nCreate budgets in the Azure portal under Cost Management > Budgets.',
      );
    }

    const tableRows = budgets.map((b) => {
      const pctUsed = b.amount > 0 ? (b.currentSpend / b.amount) * 100 : 0;
      const pctForecast = b.amount > 0 ? (b.forecastSpend / b.amount) * 100 : 0;
      const risk =
        pctForecast > BUDGET_RISK_OVER_THRESHOLD
          ? BUDGET_RISK_LABELS.OVER
          : pctForecast > BUDGET_RISK_HIGH_THRESHOLD
            ? BUDGET_RISK_LABELS.HIGH
            : pctUsed > BUDGET_RISK_WARN_THRESHOLD
              ? BUDGET_RISK_LABELS.WARN
              : BUDGET_RISK_LABELS.OK;
      return [
        b.name,
        formatMoney(b.amount, b.currency),
        formatMoney(b.currentSpend, b.currency),
        `${pctUsed.toFixed(1)}%`,
        formatMoney(b.forecastSpend, b.currency),
        risk,
      ];
    });

    const table = formatTable({
      headers: ['Budget', 'Limit', 'Spent', '%Used', 'Forecast', 'Risk'],
      rows: tableRows,
      alignRight: [1, 2, 3, 4],
    });

    const totalLimit = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.currentSpend, 0);
    const totalForecast = budgets.reduce((sum, b) => sum + b.forecastSpend, 0);
    const currency = budgets[0]?.currency || DEFAULT_CURRENCY;

    const lines = [
      `Budget Status (${budgets.length} budget(s))`,
      '',
      table,
      '',
      `Total budget: ${formatMoney(totalLimit, currency)}`,
      `Total spent: ${formatMoney(totalSpent, currency)}`,
      `Total forecast: ${formatMoney(totalForecast, currency)}`,
    ];

    if (totalForecast > totalLimit) {
      lines.push(`Projected overage: ${formatMoney(totalForecast - totalLimit, currency)}`);
    }

    return toolResult(lines.join('\n'));
  });
}
