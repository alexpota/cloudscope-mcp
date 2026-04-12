import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { setupE2EClient, callTool, callToolExpectError, pace } from './helpers.js';

const RUN_E2E = process.env.E2E_GCP === 'true';
const AZURE_CONFIGURED = process.env.E2E_AZURE === 'true';

describe.skipIf(!RUN_E2E)('GCP E2E', () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const result = await setupE2EClient();
    client = result.client;
    cleanup = result.cleanup;
  }, 30000);

  afterAll(async () => {
    await cleanup?.();
  });

  afterEach(async () => {
    await pace();
  });

  // --- Utility ---

  test('get_current_date returns valid dates', async () => {
    const text = await callTool(client, 'get_current_date');
    const today = new Date().toISOString().split('T')[0]!;
    expect(text).toContain(today);
    expect(text).toContain('Current month');
  });

  // --- Cost Analysis ---

  test('get_cost_summary with gcp provider', async () => {
    const text = await callTool(client, 'get_cost_summary', { provider: 'gcp' });
    expect(text).toContain('Cost Summary');
    expect(text).toContain('$');
  });

  test('get_cost_summary grouped by resource_group (maps to project)', async () => {
    const text = await callTool(client, 'get_cost_summary', { provider: 'gcp', group_by: 'resource_group' });
    expect(text).toContain('Cost Summary');
  });

  test('get_cost_summary grouped by region', async () => {
    const text = await callTool(client, 'get_cost_summary', { provider: 'gcp', group_by: 'region' });
    expect(text).toContain('Cost Summary');
  });

  test('get_cost_summary with custom date range', async () => {
    const text = await callTool(client, 'get_cost_summary', {
      provider: 'gcp',
      start_date: '2026-03-01',
      end_date: '2026-03-31',
    });
    expect(text).toContain('2026-03-01');
  });

  test('get_cost_by_tag returns label breakdown', async () => {
    const text = await callTool(client, 'get_cost_by_tag', { provider: 'gcp', tag_key: 'env' });
    expect(text).toContain('Cost by Tag');
  });

  test('top_spending_resources returns results or degradation message', async () => {
    const text = await callTool(client, 'top_spending_resources', { provider: 'gcp' });
    expect(text).toMatch(/Top \d+ Resources|No resource-level cost data/);
  });

  test('compare_periods returns comparison', async () => {
    const text = await callTool(client, 'compare_periods', {
      provider: 'gcp',
      period_a_start: '2026-03-01',
      period_a_end: '2026-03-31',
      period_b_start: '2026-02-01',
      period_b_end: '2026-02-28',
    });
    expect(text).toContain('Period A');
  });

  test('get_cross_project_costs returns cost data', async () => {
    const text = await callTool(client, 'get_cross_project_costs', { provider: 'gcp' });
    expect(text).toContain('$');
  });

  // --- Monitoring ---

  test('detect_anomalies on gcp', async () => {
    const text = await callTool(client, 'detect_anomalies', { provider: 'gcp' });
    expect(text).toMatch(/anomal|No anomalies detected/i);
  });

  test('check_budgets on gcp', async () => {
    const text = await callTool(client, 'check_budgets', { provider: 'gcp' });
    expect(text).toMatch(/budget|No budgets/i);
  });

  test('get_cost_forecast on gcp', async () => {
    const text = await callTool(client, 'get_cost_forecast', { provider: 'gcp' });
    expect(text).toContain('Forecast');
  });

  // --- Optimization ---

  test('list_recommendations on gcp', async () => {
    const text = await callTool(client, 'list_recommendations', { provider: 'gcp' });
    expect(text).toMatch(/recommendation|No cost optimization/i);
  });

  test('find_idle_resources on gcp', async () => {
    const text = await callTool(client, 'find_idle_resources', { provider: 'gcp' });
    expect(text).toMatch(/idle|No idle resources/i);
  });

  test('find_untagged_resources on gcp', async () => {
    const text = await callTool(client, 'find_untagged_resources', { provider: 'gcp' });
    expect(text).toMatch(/Untagged|All resources have tags/i);
  });

  // --- GCP-specific ---

  test('list_projects returns project info', async () => {
    const text = await callTool(client, 'list_projects', { provider: 'gcp' });
    expect(text).toContain('Project');
    expect(text).toContain('active');
  });

  // --- Azure not configured (skipped when both providers are active) ---

  test.skipIf(AZURE_CONFIGURED)('list_subscriptions returns error when Azure not configured', async () => {
    const text = await callToolExpectError(client, 'list_subscriptions', { provider: 'azure' });
    expect(text).toContain('Azure not configured');
  });

  // --- Prompts with GCP ---

  test('prompts/get monthly-cost-review with gcp provider', async () => {
    const result = await client.getPrompt({ name: 'monthly-cost-review', arguments: { provider: 'gcp' } });
    expect(result.messages.length).toBeGreaterThan(0);
    const text = result.messages[0]?.content as { type: string; text: string };
    expect(text.text).toContain('GCP');
  });
});
