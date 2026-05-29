import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const buildPromptText = (provider: string): string => {
  const account = provider === 'gcp' ? 'GCP project' : 'Azure subscription';
  return `I need a complete monthly cost review for my ${account}.

Follow these steps in order. Do not skip steps or change the order.

Step 1: Call get_current_date to anchor all date ranges.
Step 2: Call get_cost_summary for the current month, grouped by service.
Step 3: Call compare_periods to compare this month against last month (absolute and percentage delta).
Step 4: Call detect_anomalies for the last 7 days.
Step 5: Call top_spending_resources to list the most expensive resources this month.
Step 6: Call check_budgets to surface any budgets at risk or already exceeded.
Step 7: Call get_cost_forecast for the projected spend over the next 30 days.
Step 8: Call find_idle_resources to surface provisioned-but-unused waste.

Output format — strict. Use these H2 headings in this exact order:

## TL;DR
Two or three sentences. Lead with the headline number (total month-to-date spend in USD), the single most important finding (largest mover, largest anomaly, or budget at risk), and the one highest-value action with its estimated monthly savings in USD.

## Spend This Month
Total month-to-date spend in USD plus a per-service breakdown table sorted by cost descending.

## vs Last Month
Absolute delta in USD and percentage change, with the services driving the change.

## Anomalies
Each anomaly: service, date, observed vs expected in USD. If none, write "No anomalies detected".

## Idle & Wasted Resources
Table: resource name, type, estimated monthly cost in USD. Sort by cost descending.

## Budget Status
Each budget: name, current spend, limit, percent used, status (on-track / at-risk / over).

## Forecast
Projected next-30-day spend in USD with confidence range if available.

## Recommended Actions
Numbered list sorted by estimated monthly savings descending. Each item names the action, the specific resource or service, and the dollar impact. Format: "1. <Action> on <resource>: $<amount>/month".`;
};

export const registerMonthlyCostReviewPrompt = (server: McpServer): void => {
  server.registerPrompt(
    'monthly-cost-review',
    {
      title: 'Monthly Cost Review',
      description:
        'Run a complete monthly cost review — spending, anomalies, budgets, and forecast',
      argsSchema: {
        provider: z
          .enum(['azure', 'gcp'])
          .optional()
          .describe('Cloud provider to review (default: azure)'),
      },
    },
    (args) => ({
      messages: [
        { role: 'user', content: { type: 'text', text: buildPromptText(args.provider ?? 'azure') } },
      ],
    }),
  );
};
