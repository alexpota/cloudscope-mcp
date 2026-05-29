import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const buildPromptText = (tagKey: string, provider: string): string => {
  const account = provider === 'gcp' ? 'GCP project' : 'Azure subscription';
  const tagLabel = provider === 'gcp' ? 'label' : 'tag';
  return `Generate a cost allocation (chargeback) report for my ${account}, breaking spend down by the "${tagKey}" ${tagLabel}.

Follow these steps in order. Do not skip steps or change the order.

Step 1: Call get_current_date to anchor the windows.
Step 2: Call get_cost_by_tag for the current month, grouped by the "${tagKey}" ${tagLabel}.
Step 3: Call find_untagged_resources to identify spend that has no "${tagKey}" value and cannot be attributed.
Step 4: Call compare_periods to compare this month vs last month so you can show which ${tagKey} values moved.

Output format — strict. Use these H2 headings in this exact order:

## TL;DR
Two or three sentences. Lead with total attributed spend in USD, the highest-cost ${tagKey} value and its amount, and the percentage of total spend that is unattributed (untagged).

## Allocation by ${tagLabel}
Table: ${tagKey} value, current-month spend in USD, percent of total. Sort by spend descending.

## Unattributed (Untagged) Spend
The resources with no "${tagKey}" value. Table: name, type, resource group, and monthly cost in USD only if find_untagged_resources returns it (do not estimate). End with the total untagged spend in USD.

## Tagged vs Untagged
Total tagged spend in USD, total untagged spend in USD, and each as a percentage of the whole.

## Month-over-Month
Which ${tagKey} values increased or decreased versus last month, with absolute USD delta and percent change. Sort by absolute delta descending.

## Summary
One paragraph for finance or team leads highlighting the attribution gaps and the largest cost owners.`;
};

export const registerChargebackReportPrompt = (server: McpServer): void => {
  server.registerPrompt(
    'chargeback-report',
    {
      title: 'Cost Allocation Report',
      description:
        'Break down costs by team, environment, or project tags for chargeback and cost attribution',
      argsSchema: {
        tag_key: z
          .string()
          .describe('Tag key to group costs by, e.g. team, environment, project, department'),
        provider: z
          .enum(['azure', 'gcp'])
          .optional()
          .describe('Cloud provider to report on (default: azure)'),
      },
    },
    (args) => ({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: buildPromptText(args.tag_key, args.provider ?? 'azure') },
        },
      ],
    }),
  );
};
