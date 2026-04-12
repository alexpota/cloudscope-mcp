import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const DEFAULT_DAYS = '7';

const buildPromptText = (days: string, provider: string): string => {
  const account = provider === 'gcp' ? 'GCP project' : 'Azure subscription';
  return `Investigate a cost spike in my ${account} over the last ${days} days. I need a root-cause analysis covering:

1. Which services had the biggest cost increase compared to the prior ${days}-day period
2. Which specific resources drove the increase
3. Whether this looks like a sustained trend or a one-time spike
4. Recommended actions to reduce or stabilize the cost

Use the available CloudScope tools to gather this data. Present the result as a structured report with the findings, and end with a numbered list of concrete recommended actions in priority order.`;
};

export const registerCostSpikeInvestigationPrompt = (server: McpServer): void => {
  server.registerPrompt(
    'cost-spike-investigation',
    {
      title: 'Cost Spike Investigation',
      description: 'Investigate a cost increase — find root cause and recommend actions',
      argsSchema: {
        days: z
          .string()
          .optional()
          .describe('Number of days to compare against the prior period (default: 7)'),
        provider: z
          .enum(['azure', 'gcp'])
          .optional()
          .describe('Cloud provider to investigate (default: azure)'),
      },
    },
    (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: buildPromptText(args.days ?? DEFAULT_DAYS, args.provider ?? 'azure'),
          },
        },
      ],
    }),
  );
};
