import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const buildPromptText = (provider: string): string => {
  const account = provider === 'gcp' ? 'GCP project' : 'Azure subscription';
  const advisor = provider === 'gcp' ? 'GCP Recommender' : 'Azure Advisor';
  return `Run a waste audit on my ${account} to find spend that can be eliminated or reduced.

Follow these steps in order. Do not skip steps or change the order.

Step 1: Call get_current_date to anchor the 30-day window.
Step 2: Call find_idle_resources to surface provisioned-but-unused resources with cost estimates.
Step 3: Call find_untagged_resources to identify resources missing tags/labels (attribution gaps).
Step 4: Call list_recommendations to fetch ${advisor} optimization suggestions (right-sizing, idle resources, reservation opportunities).
Step 5: Call top_spending_resources for the last 30 days.

Output format — strict. Use these H2 headings in this exact order:

## TL;DR
Two or three sentences. Lead with the total potential monthly savings in USD, the single biggest waste item (resource name + dollar amount), and the one highest-value action to take first.

## Idle Resources
Table: name, type, monthly cost (USD). Sort by monthly cost descending.

## Untagged Resources
The resources missing attribution tags. Table: name, type, resource group. Include a monthly-cost column ONLY if find_untagged_resources returns a cost; otherwise omit it. Do not estimate.

## Optimization Recommendations
Table: recommendation, target resource, estimated monthly savings in USD, category (right-sizing / idle / reservation / other). Sort by savings descending.

## Top Spenders
Last 30 days. Table: resource, service, total cost in USD. Sort by cost descending.

## Action Plan
Numbered list sorted by estimated monthly savings descending. Each item names the action, the specific resource, and the dollar impact. Format: "1. <Action> on <resource>: $<amount>/month".

End with a final line: "**Total potential monthly savings: $<X>**".`;
};

export const registerWasteAuditPrompt = (server: McpServer): void => {
  server.registerPrompt(
    'waste-audit',
    {
      title: 'Waste Audit',
      description: 'Find wasted spend — unused resources and optimization opportunities',
      argsSchema: {
        provider: z
          .enum(['azure', 'gcp'])
          .optional()
          .describe('Cloud provider to audit (default: azure)'),
      },
    },
    (args) => ({
      messages: [
        { role: 'user', content: { type: 'text', text: buildPromptText(args.provider ?? 'azure') } },
      ],
    }),
  );
};
