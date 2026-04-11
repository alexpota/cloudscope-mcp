import type { GcpConfig } from '../../config.js';
import type { CloudCostProvider } from '../types.js';
import { GcpCostClient } from './client.js';

export interface GcpProjectInfo {
  id: string;
  name: string;
  state: string;
}

export interface GcpProviderResult {
  client: CloudCostProvider;
  projectId: string;
  projects: GcpProjectInfo[];
}

/**
 * Lists accessible GCP projects via the Resource Manager API.
 * Uses dynamic import to avoid loading GCP SDKs for Azure-only users.
 */
export async function listGcpProjects(): Promise<GcpProjectInfo[]> {
  const { ProjectsClient } = await import('@google-cloud/resource-manager');
  const client = new ProjectsClient();
  const projects: GcpProjectInfo[] = [];

  const [projectList] = await client.searchProjects();
  for (const project of projectList) {
    projects.push({
      id: project.projectId ?? '',
      name: project.displayName ?? project.projectId ?? '',
      state: String(project.state ?? 'UNKNOWN'),
    });
  }

  return projects;
}

/**
 * Initializes the GCP provider if configured.
 * Returns null if GCP env vars are not set (server starts without GCP).
 */
export async function initializeGcpProvider(
  config: GcpConfig,
): Promise<GcpProviderResult | null> {
  if (!config.projectId || !config.billingTable) {
    return null;
  }

  try {
    const client = new GcpCostClient(config);

    // Validate connectivity and detect table type (sets hasDetailedExport)
    const validation = await client.validate();
    if (!validation.connected) {
      console.error(`cloudscope-mcp | GCP: failed (${validation.detail})`);
      return null;
    }

    let projects: GcpProjectInfo[] = [];
    try {
      projects = await listGcpProjects();
    } catch {
      // Project listing is optional — proceed with empty list
      projects = [{ id: config.projectId, name: config.projectId, state: 'ACTIVE' }];
    }

    console.error(
      `cloudscope-mcp | GCP: configured (${validation.detail})`,
    );

    return { client, projectId: config.projectId, projects };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`cloudscope-mcp | GCP: initialization failed (${message})`);
    return null;
  }
}
