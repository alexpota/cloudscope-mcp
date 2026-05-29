import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPrompts } from '../src/prompts/index.js';

type PromptHandler = (args: Record<string, string>) => {
  messages: Array<{ role: string; content: { type: string; text: string } }>;
};

type PromptConfig = {
  title?: string;
  description?: string;
  argsSchema?: Record<string, unknown>;
};

describe('registerPrompts', () => {
  let registerPromptSpy: ReturnType<typeof vi.fn>;
  let fakeServer: McpServer;
  let calls: Array<[string, PromptConfig, PromptHandler]>;

  beforeEach(() => {
    registerPromptSpy = vi.fn();
    fakeServer = { registerPrompt: registerPromptSpy } as unknown as McpServer;
    registerPrompts(fakeServer);
    calls = registerPromptSpy.mock.calls as Array<[string, PromptConfig, PromptHandler]>;
  });

  const handlerFor = (name: string): PromptHandler => {
    const call = calls.find((c) => c[0] === name);
    if (!call) throw new Error(`Prompt not registered: ${name}`);
    return call[2];
  };

  const configFor = (name: string): PromptConfig => {
    const call = calls.find((c) => c[0] === name);
    if (!call) throw new Error(`Prompt not registered: ${name}`);
    return call[1];
  };

  it('registers exactly 5 prompts', () => {
    expect(registerPromptSpy).toHaveBeenCalledTimes(5);
  });

  it('registers the 5 expected prompt names', () => {
    const names = calls.map((c) => c[0]).sort();
    expect(names).toEqual([
      'chargeback-report',
      'cost-spike-investigation',
      'executive-summary',
      'monthly-cost-review',
      'waste-audit',
    ]);
  });

  it('every prompt has a non-empty title and description', () => {
    for (const [name, config] of calls) {
      expect(config.title, `${name} missing title`).toBeTruthy();
      expect(config.description, `${name} missing description`).toBeTruthy();
      expect((config.title as string).length).toBeGreaterThan(0);
      expect((config.description as string).length).toBeGreaterThan(0);
    }
  });

  describe.each([
    ['monthly-cost-review'],
    ['waste-audit'],
    ['cost-spike-investigation'],
    ['executive-summary'],
  ])('%s prompt', (name) => {
    it('returns a valid messages array', () => {
      const result = handlerFor(name)({});
      expect(result.messages).toBeInstanceOf(Array);
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it('every message has role "user" and non-empty text content', () => {
      const result = handlerFor(name)({});
      for (const msg of result.messages) {
        expect(msg.role).toBe('user');
        expect(msg.content.type).toBe('text');
        expect(msg.content.text.length).toBeGreaterThan(0);
      }
    });
  });

  describe('cost-spike-investigation argument handling', () => {
    it('declares a days argument in argsSchema', () => {
      const config = configFor('cost-spike-investigation');
      expect(config.argsSchema).toBeDefined();
      expect(config.argsSchema).toHaveProperty('days');
    });

    it('defaults to "7" when days is omitted', () => {
      const result = handlerFor('cost-spike-investigation')({});
      expect(result.messages[0]?.content.text).toContain('7');
    });

    it('includes the custom days value in the message when provided', () => {
      const result = handlerFor('cost-spike-investigation')({ days: '14' });
      expect(result.messages[0]?.content.text).toContain('14');
    });

    it('includes the custom days value for a different sample', () => {
      const result = handlerFor('cost-spike-investigation')({ days: '30' });
      expect(result.messages[0]?.content.text).toContain('30');
    });
  });

  describe('chargeback-report argument handling', () => {
    it('declares a tag_key argument in argsSchema', () => {
      const config = configFor('chargeback-report');
      expect(config.argsSchema).toBeDefined();
      expect(config.argsSchema).toHaveProperty('tag_key');
    });

    it('returns valid messages with role "user" and non-empty text', () => {
      const result = handlerFor('chargeback-report')({ tag_key: 'team' });
      expect(result.messages).toBeInstanceOf(Array);
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content.text.length).toBeGreaterThan(0);
    });

    it('includes "team" in the message when tag_key is "team"', () => {
      const result = handlerFor('chargeback-report')({ tag_key: 'team' });
      expect(result.messages[0]?.content.text).toContain('team');
    });

    it('includes "environment" in the message when tag_key is "environment"', () => {
      const result = handlerFor('chargeback-report')({ tag_key: 'environment' });
      expect(result.messages[0]?.content.text).toContain('environment');
    });
  });

  describe('new prompt pattern: TL;DR + explicit tool ordering', () => {
    const textFor = (name: string, args: Record<string, string> = {}): string => {
      const result = handlerFor(name)(args);
      return result.messages[0]?.content.text ?? '';
    };

    it.each([
      ['monthly-cost-review', {}],
      ['waste-audit', {}],
      ['cost-spike-investigation', {}],
      ['executive-summary', {}],
      ['chargeback-report', { tag_key: 'team' }],
    ])('%s starts its output spec with a "## TL;DR" heading', (name, args) => {
      expect(textFor(name, args)).toContain('## TL;DR');
    });

    it.each([
      ['monthly-cost-review', {}],
      ['waste-audit', {}],
      ['cost-spike-investigation', {}],
      ['executive-summary', {}],
      ['chargeback-report', { tag_key: 'team' }],
    ])('%s lists tool calls in explicit "Step 1:" form', (name, args) => {
      expect(textFor(name, args)).toContain('Step 1:');
    });

    it.each([
      ['monthly-cost-review', {}],
      ['cost-spike-investigation', {}],
    ])('%s calls compare_periods (not compare_costs)', (name, args) => {
      const text = textFor(name, args);
      expect(text).toContain('compare_periods');
      expect(text).not.toContain('compare_costs');
    });

    it.each([
      ['monthly-cost-review', {}],
      ['waste-audit', {}],
      ['cost-spike-investigation', {}],
    ])('%s calls top_spending_resources (not get_top_spenders)', (name, args) => {
      const text = textFor(name, args);
      expect(text).toContain('top_spending_resources');
      expect(text).not.toContain('get_top_spenders');
    });

    it('monthly-cost-review enumerates all 8 mandated steps in order', () => {
      const text = textFor('monthly-cost-review');
      const positions = [
        'get_current_date',
        'get_cost_summary',
        'compare_periods',
        'detect_anomalies',
        'top_spending_resources',
        'check_budgets',
        'get_cost_forecast',
        'find_idle_resources',
      ].map((tool) => text.indexOf(tool));
      expect(positions.every((p) => p >= 0)).toBe(true);
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThan(positions[i - 1] as number);
      }
    });
  });

  describe('provider-aware prompts', () => {
    it.each([
      ['monthly-cost-review'],
      ['waste-audit'],
      ['cost-spike-investigation'],
      ['chargeback-report'],
      ['executive-summary'],
    ])('%s declares a provider argument in argsSchema', (name) => {
      const config = configFor(name);
      expect(config.argsSchema).toHaveProperty('provider');
    });

    it('monthly-cost-review defaults to Azure language', () => {
      const result = handlerFor('monthly-cost-review')({});
      expect(result.messages[0]?.content.text).toContain('Azure subscription');
    });

    it('monthly-cost-review uses GCP language when provider is gcp', () => {
      const result = handlerFor('monthly-cost-review')({ provider: 'gcp' });
      expect(result.messages[0]?.content.text).toContain('GCP project');
      expect(result.messages[0]?.content.text).not.toContain('Azure subscription');
    });

    it('waste-audit uses Azure Advisor by default', () => {
      const result = handlerFor('waste-audit')({});
      expect(result.messages[0]?.content.text).toContain('Azure Advisor');
    });

    it('waste-audit uses GCP Recommender when provider is gcp', () => {
      const result = handlerFor('waste-audit')({ provider: 'gcp' });
      expect(result.messages[0]?.content.text).toContain('GCP Recommender');
    });

    it('chargeback-report uses label instead of tag for gcp', () => {
      const result = handlerFor('chargeback-report')({ tag_key: 'team', provider: 'gcp' });
      expect(result.messages[0]?.content.text).toContain('label');
      expect(result.messages[0]?.content.text).toContain('GCP project');
    });

    it('executive-summary declares provider argument', () => {
      const config = configFor('executive-summary');
      expect(config.argsSchema).toHaveProperty('provider');
    });

    it('executive-summary defaults to Azure language', () => {
      const result = handlerFor('executive-summary')({});
      expect(result.messages[0]?.content.text).toContain('Azure subscription');
    });

    it('executive-summary uses GCP language when provider is gcp', () => {
      const result = handlerFor('executive-summary')({ provider: 'gcp' });
      expect(result.messages[0]?.content.text).toContain('GCP project');
      expect(result.messages[0]?.content.text).not.toContain('Azure subscription');
    });
  });
});
