import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCrossProjectCosts } from '../../src/tools/cross-project-costs.js';

const mockGcpClient = {
  queryCosts: vi.fn(),
};

const projects = [
  { id: 'proj-a', name: 'Project A', state: 'ACTIVE' },
  { id: 'proj-b', name: 'Project B', state: 'ACTIVE' },
  { id: 'proj-c', name: 'Project C', state: 'ACTIVE' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleCrossProjectCosts', () => {
  it('returns cost breakdown across projects', async () => {
    mockGcpClient.queryCosts.mockResolvedValueOnce({
      rows: [
        { name: 'proj-a', cost: 500 },
        { name: 'proj-b', cost: 300 },
        { name: 'proj-c', cost: 200 },
      ],
      currency: 'USD',
    });

    const result = await handleCrossProjectCosts(
      { provider: 'gcp', start_date: '2026-04-01', end_date: '2026-04-10' },
      { azure: null, gcp: mockGcpClient as any },
      projects,
    );

    const text = result.content[0].text;
    expect(text).toContain('Project A');
    expect(text).toContain('Project B');
    expect(text).toContain('TOTAL');
    expect(text).toContain('$1,000.00');
  });

  it('filters to specified project IDs', async () => {
    mockGcpClient.queryCosts.mockResolvedValueOnce({
      rows: [
        { name: 'proj-a', cost: 500 },
        { name: 'proj-b', cost: 300 },
        { name: 'proj-c', cost: 200 },
      ],
      currency: 'USD',
    });

    const result = await handleCrossProjectCosts(
      { provider: 'gcp', project_ids: ['proj-a'], start_date: '2026-04-01', end_date: '2026-04-10' },
      { azure: null, gcp: mockGcpClient as any },
      projects,
    );

    const text = result.content[0].text;
    expect(text).toContain('Project A');
    expect(text).not.toContain('Project B');
  });

  it('returns error when GCP is not configured', async () => {
    const result = await handleCrossProjectCosts(
      { provider: 'gcp', start_date: '2026-04-01', end_date: '2026-04-10' },
      { azure: null, gcp: null },
      projects,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not configured');
  });

  it('returns error when no projects available', async () => {
    const result = await handleCrossProjectCosts(
      { provider: 'gcp', start_date: '2026-04-01', end_date: '2026-04-10' },
      { azure: null, gcp: mockGcpClient as any },
      [],
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No GCP projects');
  });

  it('rejects invalid date range', async () => {
    const result = await handleCrossProjectCosts(
      { provider: 'gcp', start_date: 'bad-date', end_date: '2026-04-10' },
      { azure: null, gcp: mockGcpClient as any },
      projects,
    );

    expect(result.isError).toBe(true);
  });
});
