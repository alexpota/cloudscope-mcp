import { describe, it, expect } from 'vitest';
import { handleListProjects } from '../../src/tools/list-projects.js';

describe('handleListProjects', () => {
  it('returns formatted table with project info', () => {
    const result = handleListProjects(
      [
        { id: 'proj-a', name: 'Project A', state: 'ACTIVE' },
        { id: 'proj-b', name: 'Project B', state: 'ACTIVE' },
      ],
      'proj-a',
    );

    const text = result.content[0].text;
    expect(text).toContain('Project A (active)');
    expect(text).toContain('proj-a');
    expect(text).toContain('Project B');
    expect(text).toContain('2 found');
  });

  it('returns error when no projects available', () => {
    const result = handleListProjects([], '');

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No GCP projects');
  });

  it('marks only the active project', () => {
    const result = handleListProjects(
      [
        { id: 'proj-a', name: 'A', state: 'ACTIVE' },
        { id: 'proj-b', name: 'B', state: 'ACTIVE' },
      ],
      'proj-b',
    );

    const text = result.content[0].text;
    expect(text).not.toContain('A (active)');
    expect(text).toContain('B (active)');
  });
});
