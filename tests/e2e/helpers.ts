import { expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/server.js';

export async function setupE2EClient(): Promise<{
  client: Client;
  cleanup: () => Promise<void>;
}> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = await createServer();
  await server.connect(serverTransport);

  const client = new Client({ name: 'e2e-test', version: '1.0.0' });
  await client.connect(clientTransport);

  return {
    client,
    cleanup: async () => {
      await client.close();
      await server.close();
    },
  };
}

export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text: string }>;
  let text = content[0]?.text ?? '';

  // One retry for Azure 429 rate limits during rapid E2E testing
  if (result.isError && text.includes('Too many requests')) {
    await new Promise((resolve) => setTimeout(resolve, 15000));
    const retry = await client.callTool({ name, arguments: args });
    const retryContent = retry.content as Array<{ type: string; text: string }>;
    text = retryContent[0]?.text ?? '';
    expect(retryContent).toBeDefined();
    expect(retryContent.length).toBeGreaterThan(0);
    expect(text.length).toBeGreaterThan(0);
    return text;
  }

  expect(content).toBeDefined();
  expect(content.length).toBeGreaterThan(0);
  expect(text.length).toBeGreaterThan(0);
  return text;
}

export async function callToolExpectError(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError).toBe(true);
  const content = result.content as Array<{ type: string; text: string }>;
  return content[0]?.text ?? '';
}

export const E2E_DELAY_MS = 5000;

export function pace(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, E2E_DELAY_MS));
}
