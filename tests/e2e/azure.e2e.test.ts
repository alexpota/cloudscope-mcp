import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { setupE2EClient, callTool, callToolExpectError, pace } from './helpers.js';

const RUN_E2E = process.env.E2E_AZURE === 'true';
const GCP_CONFIGURED = !!process.env.GOOGLE_CLOUD_PROJECT && !!process.env.GCP_BILLING_TABLE;

describe.skipIf(!RUN_E2E)('Azure E2E', () => {
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

  test('get_cost_summary with default provider', async () => {
    const text = await callTool(client, 'get_cost_summary');
    expect(text).toContain('Cost Summary');
    expect(text).toContain('$');
    expect(text).toContain('TOTAL');
  });

  test('get_cost_summary with explicit azure provider', async () => {
    const text = await callTool(client, 'get_cost_summary', { provider: 'azure' });
    expect(text).toContain('Cost Summary');
    expect(text).toContain('$');
  });

  test('get_cost_summary grouped by resource_group', async () => {
    const text = await callTool(client, 'get_cost_summary', { provider: 'azure', group_by: 'resource_group' });
    expect(text).toContain('Cost Summary');
  });

  test('get_cost_summary grouped by region', async () => {
    const text = await callTool(client, 'get_cost_summary', { provider: 'azure', group_by: 'region' });
    expect(text).toContain('Cost Summary');
  });

  test('get_cost_summary with custom date range', async () => {
    const text = await callTool(client, 'get_cost_summary', {
      provider: 'azure',
      start_date: '2026-03-01',
      end_date: '2026-03-31',
    });
    expect(text).toContain('2026-03-01');
    expect(text).toContain('2026-03-31');
  });

  test('get_cost_by_tag returns tag breakdown', async () => {
    const text = await callTool(client, 'get_cost_by_tag', { provider: 'azure', tag_key: 'environment' });
    expect(text).toContain('Cost by Tag');
    expect(text).toContain('environment');
  });

  test('compare_periods returns comparison', async () => {
    const text = await callTool(client, 'compare_periods', {
      provider: 'azure',
      period_a_start: '2026-03-01',
      period_a_end: '2026-03-31',
      period_b_start: '2026-02-01',
      period_b_end: '2026-02-28',
    });
    expect(text).toContain('Period A');
    expect(text).toContain('Period B');
  });

  test('top_spending_resources returns resource list', async () => {
    const text = await callTool(client, 'top_spending_resources', { provider: 'azure' });
    expect(text).toMatch(/Top \d+ Resources|No resource-level cost data/);
  });

  test('top_spending_resources with custom limit', async () => {
    const text = await callTool(client, 'top_spending_resources', { provider: 'azure', days: 7, limit: 5 });
    expect(text).toMatch(/Top \d+ Resources|No resource-level cost data/);
  });

  test('get_cross_subscription_costs returns cost data', async () => {
    const text = await callTool(client, 'get_cross_subscription_costs', { provider: 'azure' });
    expect(text).toContain('$');
  });

  // --- Monitoring ---

  test('detect_anomalies with defaults', async () => {
    const text = await callTool(client, 'detect_anomalies', { provider: 'azure' });
    expect(text).toMatch(/anomal|No anomalies detected/i);
  });

  test('detect_anomalies with custom days and threshold', async () => {
    const text = await callTool(client, 'detect_anomalies', { provider: 'azure', days: 14, threshold: 10 });
    expect(text).toMatch(/anomal|No anomalies detected/i);
  });

  test('check_budgets returns budget info', async () => {
    const text = await callTool(client, 'check_budgets', { provider: 'azure' });
    expect(text).toMatch(/budget|No budgets/i);
  });

  test('get_cost_forecast with defaults', async () => {
    const text = await callTool(client, 'get_cost_forecast', { provider: 'azure' });
    expect(text).toContain('Forecast');
  });

  test('get_cost_forecast with custom days', async () => {
    const text = await callTool(client, 'get_cost_forecast', { provider: 'azure', days: 14 });
    expect(text).toContain('Forecast');
  });

  // --- Optimization ---

  test('list_recommendations returns results', async () => {
    const text = await callTool(client, 'list_recommendations', { provider: 'azure' });
    expect(text).toMatch(/recommendation|No cost optimization/i);
  });

  test('list_recommendations filtered by compute', async () => {
    const text = await callTool(client, 'list_recommendations', { provider: 'azure', category: 'compute' });
    expect(text).toMatch(/recommendation|No cost optimization/i);
  });

  test('find_idle_resources returns results', async () => {
    const text = await callTool(client, 'find_idle_resources', { provider: 'azure' });
    expect(text).toMatch(/idle|No idle resources/i);
  });

  test('find_untagged_resources returns results', async () => {
    const text = await callTool(client, 'find_untagged_resources', { provider: 'azure' });
    expect(text).toMatch(/Untagged|All resources have tags/i);
  });

  // --- Azure-specific ---

  test('list_subscriptions returns subscription info', async () => {
    const text = await callTool(client, 'list_subscriptions', { provider: 'azure' });
    expect(text).toContain('Subscription');
    expect(text).toContain('active');
  });

  // --- GCP not configured (skipped when both providers are active) ---

  test.skipIf(GCP_CONFIGURED)('list_projects returns error when GCP not configured', async () => {
    const text = await callToolExpectError(client, 'list_projects', { provider: 'gcp' });
    expect(text).toContain('GCP not configured');
  });

  test.skipIf(GCP_CONFIGURED)('get_cost_summary with gcp returns error when GCP not configured', async () => {
    const text = await callToolExpectError(client, 'get_cost_summary', { provider: 'gcp' });
    expect(text).toContain('not configured');
  });

  test.skipIf(GCP_CONFIGURED)('get_cross_project_costs returns error when GCP not configured', async () => {
    const text = await callToolExpectError(client, 'get_cross_project_costs', { provider: 'gcp' });
    expect(text).toMatch(/not configured|No GCP projects/);
  });

  // --- Prompts ---

  test('prompts/list returns 5 prompts', async () => {
    const result = await client.listPrompts();
    expect(result.prompts.length).toBe(5);
    const names = result.prompts.map((p) => p.name);
    expect(names).toContain('monthly-cost-review');
    expect(names).toContain('waste-audit');
    expect(names).toContain('cost-spike-investigation');
    expect(names).toContain('executive-summary');
    expect(names).toContain('chargeback-report');
  });

  test('prompts/get monthly-cost-review returns messages', async () => {
    const result = await client.getPrompt({ name: 'monthly-cost-review', arguments: {} });
    expect(result.messages.length).toBeGreaterThan(0);
    const text = result.messages[0]?.content as { type: string; text: string };
    expect(text.text.length).toBeGreaterThan(0);
  });

  test('prompts/get chargeback-report with tag_key', async () => {
    const result = await client.getPrompt({ name: 'chargeback-report', arguments: { tag_key: 'environment' } });
    expect(result.messages.length).toBeGreaterThan(0);
    const text = result.messages[0]?.content as { type: string; text: string };
    expect(text.text).toContain('environment');
  });

  test('prompts/get cost-spike-investigation with days', async () => {
    const result = await client.getPrompt({ name: 'cost-spike-investigation', arguments: { days: '14' } });
    expect(result.messages.length).toBeGreaterThan(0);
  });

  test('prompts/get executive-summary returns messages', async () => {
    const result = await client.getPrompt({ name: 'executive-summary', arguments: {} });
    expect(result.messages.length).toBeGreaterThan(0);
  });
});
