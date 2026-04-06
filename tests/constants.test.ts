import { describe, it, expect } from 'vitest';
import {
  PACKAGE_NAME,
  PACKAGE_VERSION,
  DEFAULT_ANOMALY_DAYS,
  DEFAULT_ANOMALY_THRESHOLD,
  DEFAULT_FORECAST_DAYS,
  DEFAULT_TOP_RESOURCES_LIMIT,
  DEFAULT_TOP_RESOURCES_DAYS,
  DEFAULT_CACHE_TTL_SECONDS,
  MAX_CACHE_ENTRIES,
} from '../src/constants.js';

describe('constants', () => {
  it('exports package identity', () => {
    expect(PACKAGE_NAME).toBe('cloudscope-mcp');
    expect(PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('exports default values as positive numbers', () => {
    const defaults = [
      DEFAULT_ANOMALY_DAYS,
      DEFAULT_ANOMALY_THRESHOLD,
      DEFAULT_FORECAST_DAYS,
      DEFAULT_TOP_RESOURCES_LIMIT,
      DEFAULT_TOP_RESOURCES_DAYS,
      DEFAULT_CACHE_TTL_SECONDS,
      MAX_CACHE_ENTRIES,
    ];

    for (const d of defaults) {
      expect(d).toBeGreaterThan(0);
      expect(Number.isInteger(d)).toBe(true);
    }
  });
});
