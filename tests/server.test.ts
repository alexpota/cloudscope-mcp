import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Tests Zod schema validation for tool inputs.
 * These test what happens BEFORE the tool handler is called.
 */

describe('Tool input schema validation', () => {
  const costSummarySchema = z.object({
    provider: z.enum(['azure', 'gcp']).default('azure'),
    start_date: z.string(),
    end_date: z.string(),
    group_by: z.enum(['service', 'resource_group', 'tag', 'region']).default('service'),
  });

  const anomaliesSchema = z.object({
    provider: z.enum(['azure', 'gcp']).default('azure'),
    days: z.number().default(7),
    threshold: z.number().default(20),
  });

  const forecastSchema = z.object({
    provider: z.enum(['azure', 'gcp']).default('azure'),
    days: z.number().default(30),
  });

  describe('invalid provider values are rejected', () => {
    it('rejects provider=aws', () => {
      const result = costSummarySchema.safeParse({
        provider: 'aws',
        start_date: '2026-03-01',
        end_date: '2026-03-31',
      });
      expect(result.success).toBe(false);
    });

    it('accepts provider=gcp', () => {
      const result = costSummarySchema.safeParse({
        provider: 'gcp',
        start_date: '2026-03-01',
        end_date: '2026-03-31',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty provider', () => {
      const result = costSummarySchema.safeParse({
        provider: '',
        start_date: '2026-03-01',
        end_date: '2026-03-31',
      });
      expect(result.success).toBe(false);
    });

    it('rejects provider=aws for anomalies', () => {
      const result = anomaliesSchema.safeParse({ provider: 'aws' });
      expect(result.success).toBe(false);
    });

    it('rejects provider=aws for forecast', () => {
      const result = forecastSchema.safeParse({ provider: 'aws' });
      expect(result.success).toBe(false);
    });
  });

  describe('missing required fields', () => {
    it('defaults provider when omitted', () => {
      const result = costSummarySchema.safeParse({
        start_date: '2026-03-01',
        end_date: '2026-03-31',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toBe('azure');
      }
    });

    it('rejects missing start_date', () => {
      const result = costSummarySchema.safeParse({
        provider: 'azure',
        end_date: '2026-03-31',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('invalid date strings pass Zod (string type, not date)', () => {
    it('"2026-13-45" passes Zod (it is a string)', () => {
      const result = costSummarySchema.safeParse({
        provider: 'azure',
        start_date: '2026-13-45',
        end_date: '2026-03-31',
      });
      expect(result.success).toBe(true);
    });

    it('"yesterday" passes Zod (it is a string)', () => {
      const result = costSummarySchema.safeParse({
        provider: 'azure',
        start_date: 'yesterday',
        end_date: '2026-03-31',
      });
      expect(result.success).toBe(true);
    });

    it('empty string passes Zod (it is a string)', () => {
      const result = costSummarySchema.safeParse({
        provider: 'azure',
        start_date: '',
        end_date: '',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('defaults are applied', () => {
    it('group_by defaults to service', () => {
      const result = costSummarySchema.parse({
        provider: 'azure',
        start_date: '2026-03-01',
        end_date: '2026-03-31',
      });
      expect(result.group_by).toBe('service');
    });

    it('days defaults to 7 for anomalies', () => {
      const result = anomaliesSchema.parse({ provider: 'azure' });
      expect(result.days).toBe(7);
      expect(result.threshold).toBe(20);
    });

    it('days defaults to 30 for forecast', () => {
      const result = forecastSchema.parse({ provider: 'azure' });
      expect(result.days).toBe(30);
    });
  });
});
