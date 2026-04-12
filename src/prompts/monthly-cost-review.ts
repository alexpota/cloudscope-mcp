import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const buildPromptText = (provider: string): string => {
  const account = provider === 'gcp' ? 'GCP project' : 'Azure subscription';
  return `I need a complete monthly cost review for my ${account}. Cover these sections:

1. Current month spending broken down by service
2. Comparison to last month with absolute and percentage changes
3. Cost anomalies or unexpected spikes in the last week
4. Top 10 most expensive individual resources this month
5. Budget status and overage risk
6. Projected spend for next month
7. Top cost-saving opportunities
8. Any idle or unused resources that could be cleaned up

Use the available CloudScope tools to gather this data. If the current date is unclear, look it up first so the date ranges are accurate. Present the result as a structured markdown report with the sections above as H2 headings, ending with a numbered "Action items" list ranked by potential savings impact.`;
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
