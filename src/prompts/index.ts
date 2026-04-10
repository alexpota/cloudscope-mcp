import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMonthlyCostReviewPrompt } from './monthly-cost-review.js';
import { registerWasteAuditPrompt } from './waste-audit.js';
import { registerCostSpikeInvestigationPrompt } from './cost-spike-investigation.js';
import { registerExecutiveSummaryPrompt } from './executive-summary.js';
import { registerChargebackReportPrompt } from './chargeback-report.js';

export function registerPrompts(server: McpServer): void {
  registerMonthlyCostReviewPrompt(server);
  registerWasteAuditPrompt(server);
  registerCostSpikeInvestigationPrompt(server);
  registerExecutiveSummaryPrompt(server);
  registerChargebackReportPrompt(server);
}
