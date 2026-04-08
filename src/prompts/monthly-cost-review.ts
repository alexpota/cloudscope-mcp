import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const PROMPT_TEXT = `I need a complete monthly cost review for my Azure subscription. Cover these sections:

1. Current month spending broken down by service
2. Comparison to last month with absolute and percentage changes
3. Cost anomalies or unexpected spikes in the last week
4. Budget status and overage risk
5. Projected spend for next month
6. Top cost-saving opportunities

Use the available CloudScope tools to gather this data. If the current date is unclear, look it up first so the date ranges are accurate. Present the result as a structured markdown report with the six sections above as H2 headings, ending with a numbered "Action items" list ranked by potential savings impact.`;

export const registerMonthlyCostReviewPrompt = (server: McpServer): void => {
  server.registerPrompt(
    'monthly-cost-review',
    {
      title: 'Monthly Cost Review',
      description:
        'Run a complete monthly cost review — spending, anomalies, budgets, and forecast',
    },
    () => ({
      messages: [{ role: 'user', content: { type: 'text', text: PROMPT_TEXT } }],
    }),
  );
};
