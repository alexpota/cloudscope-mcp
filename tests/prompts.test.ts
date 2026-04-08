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

  it('registers exactly 4 prompts', () => {
    expect(registerPromptSpy).toHaveBeenCalledTimes(4);
  });

  it('registers the 4 expected prompt names', () => {
    const names = calls.map((c) => c[0]).sort();
    expect(names).toEqual([
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
});
