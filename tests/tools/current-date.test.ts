import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleGetCurrentDate } from '../../src/tools/current-date.js';

describe('handleGetCurrentDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns today and month boundaries', () => {
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));

    const result = handleGetCurrentDate();

    const text = result.content[0].text;
    expect(text).toContain('Today: 2026-04-15');
    expect(text).toContain('Current month: 2026-04-01 to 2026-04-30');
    expect(text).toContain('Previous month: 2026-03-01 to 2026-03-31');
  });

  it('handles January (previous month is December of prior year)', () => {
    vi.setSystemTime(new Date('2026-01-10T12:00:00Z'));

    const result = handleGetCurrentDate();

    const text = result.content[0].text;
    expect(text).toContain('Today: 2026-01-10');
    expect(text).toContain('Current month: 2026-01-01 to 2026-01-31');
    expect(text).toContain('Previous month: 2025-12-01 to 2025-12-31');
  });

  it('handles February in leap year', () => {
    vi.setSystemTime(new Date('2028-02-15T12:00:00Z'));

    const result = handleGetCurrentDate();

    const text = result.content[0].text;
    expect(text).toContain('Current month: 2028-02-01 to 2028-02-29');
    expect(text).toContain('Previous month: 2028-01-01 to 2028-01-31');
  });

  it('never returns isError', () => {
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    const result = handleGetCurrentDate();
    expect(result.isError).toBeUndefined();
  });
});
