import { formatTable } from '../utils/formatter.js';
import { toolResult, toolError, type ToolResult } from './types.js';
import type { GcpProjectInfo } from '../providers/gcp/discovery.js';

export function handleListProjects(
  projects: GcpProjectInfo[],
  activeProjectId: string,
): ToolResult {
  if (projects.length === 0) {
    return toolError(new Error('No GCP projects found for the current credential.'));
  }

  const rows = projects.map((p) => [
    p.id === activeProjectId ? `${p.name} (active)` : p.name,
    p.id,
    p.state,
  ]);

  const table = formatTable({
    headers: ['Project', 'ID', 'State'],
    rows,
    alignRight: [],
  });

  const lines = [
    `GCP Projects (${projects.length} found)`,
    '',
    table,
  ];

  return toolResult(lines.join('\n'));
}
