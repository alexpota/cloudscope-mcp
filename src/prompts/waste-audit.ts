import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const buildPromptText = (provider: string): string => {
  const account = provider === 'gcp' ? 'GCP project' : 'Azure subscription';
  const advisor = provider === 'gcp' ? 'GCP Recommender' : 'Azure Advisor';
  return `Run a waste audit on my ${account}. I want to find spend that can be eliminated or reduced. Cover:

1. The most expensive individual resources over the last 30 days
2. Cost optimization recommendations from ${advisor} — right-sizing, idle resources, reservation opportunities
3. Any budgets that are at risk of being exceeded
4. A total of potential savings in USD
5. Idle resources that are provisioned but not actively used — unattached disks, orphaned network interfaces, unused public IPs, empty App Service plans — with estimated monthly cost for each
6. Resources with no tags applied that cannot be attributed to teams or projects

Use the available CloudScope tools to gather this data. Present the result as a prioritized list of waste items, each with the resource or recommendation name, estimated monthly savings if known, and a one-line justification. End with a summary line stating the total potential monthly savings.`;
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
