import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const DEFAULT_DAYS = '7';

const buildPromptText = (days: string, provider: string): string => {
  const account = provider === 'gcp' ? 'GCP project' : 'Azure subscription';
  return `Investigate a cost spike in my ${account} over the last ${days} days. Build a root-cause analysis.

Follow these steps in order. Do not skip steps or change the order.

Step 1: Call get_current_date to anchor the windows.
Step 2: Call compare_periods to compare the last ${days} days vs the prior ${days} days (absolute and percent change per service).
Step 3: Call detect_anomalies for the last ${days} days.
Step 4: Call top_spending_resources for the last ${days} days.
Step 5: For the top 3 services by absolute increase in Step 2, call get_cost_summary grouped by service to drill into the daily trend. If get_cost_summary cannot filter to a single service, group by service and read the relevant rows.

Output format — strict. Use these H2 headings in this exact order:

## TL;DR
Two or three sentences. Lead with the total incremental dollar increase versus the prior period, the single likely root cause (service + resource), and the one highest-value corrective action with its estimated monthly savings in USD.

## Likely Root Cause
Plain-language explanation: which service, which resource(s), why the cost moved, and whether this looks like a one-time spike or a sustained trend.

## What Changed
Per-service delta table: service, prior-period spend (USD), current spend (USD), absolute delta (USD), percent change. Sort by absolute delta descending.

## Top Contributors
Resource-level table: resource name, service, spend over ${days} days in USD, share of total increase in percent. Sort by spend descending.

## Recommended Actions
Numbered list sorted by estimated monthly savings descending. Each item names the action, the specific resource, and the dollar impact. Format: "1. <Action> on <resource>: $<amount>/month".`;
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
