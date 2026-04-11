import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSearchProjects = vi.fn();

vi.mock('@google-cloud/resource-manager', () => ({
  ProjectsClient: vi.fn().mockImplementation(() => ({
    searchProjects: mockSearchProjects,
  })),
}));

// Mock client.ts so initializeGcpProvider doesn't hit real BigQuery
vi.mock('../../../src/providers/gcp/client.js', () => ({
  GcpCostClient: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockResolvedValue({ connected: true, detail: 'ok' }),
  })),
}));

import { initializeGcpProvider, listGcpProjects } from '../../../src/providers/gcp/discovery.js';

describe('GCP discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listGcpProjects', () => {
    it('returns projects from Resource Manager API', async () => {
      mockSearchProjects.mockResolvedValueOnce([
        [
          { projectId: 'proj-a', displayName: 'Project A', state: 'ACTIVE' },
          { projectId: 'proj-b', displayName: 'Project B', state: 'ACTIVE' },
        ],
      ]);

      const projects = await listGcpProjects();

      expect(projects).toHaveLength(2);
      expect(projects[0]).toEqual({ id: 'proj-a', name: 'Project A', state: 'ACTIVE' });
      expect(projects[1]).toEqual({ id: 'proj-b', name: 'Project B', state: 'ACTIVE' });
    });

    it('handles missing display name by falling back to projectId', async () => {
      mockSearchProjects.mockResolvedValueOnce([
        [{ projectId: 'proj-x', state: 'ACTIVE' }],
      ]);

      const projects = await listGcpProjects();

      expect(projects[0]?.name).toBe('proj-x');
    });
  });

  describe('initializeGcpProvider', () => {
    it('returns null when projectId is empty', async () => {
      const result = await initializeGcpProvider({
        projectId: '',
        billingTable: 'some-table',
      });
      expect(result).toBeNull();
    });

    it('returns null when billingTable is empty', async () => {
      const result = await initializeGcpProvider({
        projectId: 'my-project',
        billingTable: '',
      });
      expect(result).toBeNull();
    });

    it('returns provider result when configured', async () => {
      mockSearchProjects.mockResolvedValueOnce([
        [{ projectId: 'my-project', displayName: 'My Project', state: 'ACTIVE' }],
      ]);

      const result = await initializeGcpProvider({
        projectId: 'my-project',
        billingTable: 'my-project.billing.gcp_billing_export_v1_ABCDEF',
      });

      expect(result).not.toBeNull();
      expect(result?.projectId).toBe('my-project');
      expect(result?.projects).toHaveLength(1);
    });

    it('falls back to config projectId when project listing fails', async () => {
      mockSearchProjects.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await initializeGcpProvider({
        projectId: 'my-project',
        billingTable: 'my-project.billing.gcp_billing_export_v1_ABCDEF',
      });

      expect(result).not.toBeNull();
      expect(result?.projects).toEqual([
        { id: 'my-project', name: 'my-project', state: 'ACTIVE' },
      ]);
    });
  });
});
