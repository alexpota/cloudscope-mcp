import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateDateRange, todayYMD, firstOfCurrentMonth } from '../../src/utils/dates.js';

describe('validateDateRange', () => {
  it('returns null for valid date range', () => {
    expect(validateDateRange('2026-03-01', '2026-03-31')).toBeNull();
  });

  it('returns null for same start and end date', () => {
    expect(validateDateRange('2026-03-15', '2026-03-15')).toBeNull();
  });

  it('rejects invalid format: YYYY/MM/DD', () => {
    const err = validateDateRange('2026/03/01', '2026-03-31');
    expect(err).toContain('Invalid start_date');
    expect(err).toContain('YYYY-MM-DD');
  });

  it('rejects invalid format: "yesterday"', () => {
    const err = validateDateRange('yesterday', '2026-03-31');
    expect(err).toContain('Invalid start_date');
  });

  it('rejects empty string', () => {
    const err = validateDateRange('', '2026-03-31');
    expect(err).toContain('Invalid start_date');
  });

  it('rejects impossible date: 2026-13-45', () => {
    const err = validateDateRange('2026-13-45', '2026-03-31');
    expect(err).toContain('Not a valid date');
  });

  it('rejects start_date after end_date', () => {
    const err = validateDateRange('2026-03-31', '2026-03-01');
    expect(err).toContain('start_date');
    expect(err).toContain('after');
    expect(err).toContain('end_date');
  });

  it('rejects invalid end_date format', () => {
    const err = validateDateRange('2026-03-01', 'invalid');
    expect(err).toContain('Invalid end_date');
  });
});

describe('todayYMD and firstOfCurrentMonth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('todayYMD returns correct date', () => {
    vi.setSystemTime(new Date(2026, 3, 15)); // April 15
    expect(todayYMD()).toBe('2026-04-15');
  });

  it('firstOfCurrentMonth returns first day', () => {
    vi.setSystemTime(new Date(2026, 3, 15));
    expect(firstOfCurrentMonth()).toBe('2026-04-01');
  });
});
