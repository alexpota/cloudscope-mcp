import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const buildPromptText = (tagKey: string, provider: string): string => {
  const account = provider === 'gcp' ? 'GCP project' : 'Azure subscription';
  const tagLabel = provider === 'gcp' ? 'label' : 'tag';
  return `Generate a cost allocation report for my ${account}, breaking down all spending by the "${tagKey}" ${tagLabel}. Cover:

1. Current month costs grouped by each value of the ${tagKey} ${tagLabel}, sorted by cost descending
2. Untagged resources that cannot be attributed — list them with their type and resource group
3. A summary showing total tagged spend vs total untagged spend, with percentages
4. Comparison to last month: which ${tagKey} values increased or decreased, by how much
5. The top 3 most expensive resources within the highest-cost ${tagKey} value

Use the available CloudScope tools to gather this data. If the current date is unclear, determine it first. Present the result as a structured report with the sections above, suitable for sharing with finance or team leads for chargeback purposes. End with a one-paragraph summary highlighting the largest cost center and any attribution gaps.`;
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
