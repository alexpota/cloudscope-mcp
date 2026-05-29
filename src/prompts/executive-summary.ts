import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const buildPromptText = (provider: string): string => {
  const account = provider === 'gcp' ? 'GCP project' : 'Azure subscription';
  return `Generate a brief executive cost summary for my ${account}. The audience is non-technical leadership — they want the bottom line.

Follow these steps in order. Do not skip steps or change the order.

Step 1: Call get_current_date to anchor the windows.
Step 2: Call get_cost_summary for the current month, grouped by service.
Step 3: Call compare_periods to compare this month vs last month.
Step 4: Call check_budgets to determine budget health.
Step 5: Call get_cost_forecast for the next 30 days.

Output format — strict. Keep the total under 10 sentences. No raw resource IDs, no tool names, no technical jargon. Use only USD figures rounded to the nearest dollar.

## TL;DR
Two or three sentences. Lead with month-to-date spend in USD, the trend versus last month (up or down by what dollar amount and percentage), and one health indicator: on-track, watch, or over.

## Summary
A short narrative paragraph, in prose (not a bulleted list), covering: total spend this month and direction versus last month in dollars; budget health using the same on-track / watch / over indicator; the top three cost drivers by service (names only, no resource IDs); the forecast for next month in dollars; and one key recommendation with its estimated monthly savings in dollars.

## Recommended Action
A single sentence stating the one highest-value action and its dollar impact per month. Format: "<Action> would save approximately $<amount>/month".`;
};

export const registerExecutiveSummaryPrompt = (server: McpServer): void => {
  server.registerPrompt(
    'executive-summary',
    {
      title: 'Executive Cost Summary',
      description: 'Generate a brief executive cost summary for leadership or stakeholders',
      argsSchema: {
        provider: z
          .enum(['azure', 'gcp'])
          .optional()
          .describe('Cloud provider to summarize (default: azure)'),
      },
    },
    (args) => ({
      messages: [
        { role: 'user', content: { type: 'text', text: buildPromptText(args.provider ?? 'azure') } },
      ],
    }),
  );
};
