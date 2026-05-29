import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CloudCostProvider } from '../providers/types.js';

export type ToolResult = CallToolResult;

export interface Providers {
  azure: CloudCostProvider | null;
  gcp: CloudCostProvider | null;
}

export function toolResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

export function toolError(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

export async function withProvider(
  providers: Providers,
  providerName: 'azure' | 'gcp',
  handler: (provider: CloudCostProvider) => Promise<ToolResult>,
): Promise<ToolResult> {
  const provider = providers[providerName];
  if (!provider) {
    return toolError(
      new Error(`${providerName} is not configured. Set the required environment variables.`),
    );
  }
  try {
    return await handler(provider);
  } catch (err) {
    // stderr is operator-visible and never reaches the JSON-RPC stdio channel.
    // The user-facing message intentionally stays generic so raw Azure payloads
    // (GUIDs, internal endpoints, principal names) don't leak to the LLM client.
    console.error(`[${providerName}] request failed:`, err);
    return toolError(
      new Error(`${providerName} request failed. Please try again.`),
    );
  }
}
