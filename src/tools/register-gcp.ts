import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { GcpProjectInfo } from '../providers/gcp/discovery.js';
import { handleListProjects } from './list-projects.js';
import { handleCrossProjectCosts } from './cross-project-costs.js';
import { toolError, type Providers } from './types.js';

export function registerGcpTools(
  server: McpServer,
  providers: Providers,
  gcp: { projects: GcpProjectInfo[]; projectId: string },
): void {
  server.registerTool(
    'list_projects',
    {
      title: 'List GCP Projects',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      description:
        'Returns all GCP projects the current credential can access, with name, ID, and state. Shows which project is currently active. Use this when the user has multiple GCP projects and wants to see which ones are available, or before calling get_cross_project_costs.',
      inputSchema: {
        provider: z.literal('gcp').describe('Cloud provider (GCP-only tool)'),
      },
    },
    () => {
      if (gcp.projects.length === 0) {
        return toolError(
          new Error('GCP not configured. Set GOOGLE_CLOUD_PROJECT and GCP_BILLING_TABLE.'),
        );
      }
      return handleListProjects(gcp.projects, gcp.projectId);
    },
  );

  server.registerTool(
    'get_cross_project_costs',
    {
      title: 'Cross-Project Cost Summary',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      description:
        'Returns a combined cost breakdown across multiple GCP projects sorted by total spend. Each project shows its name, total cost in USD, and percentage of the combined total. Use this when the user asks about costs across all GCP projects, wants to compare project spending, or needs an organization-wide cost overview.',
      inputSchema: {
        provider: z.literal('gcp').describe('Cloud provider (GCP-only tool)'),
        project_ids: z
          .array(z.string())
          .optional()
          .describe('Project IDs to include. Defaults to all known projects.'),
        start_date: z
          .string()
          .optional()
          .describe('Start date (YYYY-MM-DD). Defaults to first of current month.'),
        end_date: z
          .string()
          .optional()
          .describe('End date (YYYY-MM-DD). Defaults to today.'),
      },
    },
    async (input) => handleCrossProjectCosts(input, providers, gcp.projects),
  );
}
