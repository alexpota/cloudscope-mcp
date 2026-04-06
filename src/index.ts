#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { getConfig } from './config.js';
import { AzureCostClient } from './providers/azure/client.js';
import { PACKAGE_NAME, PACKAGE_VERSION } from './constants.js';

const args = process.argv.slice(2);

if (args.includes('--version')) {
  process.stdout.write(`${PACKAGE_NAME} ${PACKAGE_VERSION}\n`);
  process.exit(0);
}

if (args.includes('--validate')) {
  await validate();
  process.exit(0);
}

// Normal MCP startup
const config = getConfig();
const azureStatus = config.azure ? 'configured' : 'not configured';
console.error(`${PACKAGE_NAME} v${PACKAGE_VERSION} | Azure: ${azureStatus}`);

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);

async function validate(): Promise<void> {
  const config = getConfig();

  if (!config.azure) {
    process.stdout.write('Azure: Not configured (set AZURE_SUBSCRIPTION_ID)\n');
    process.exit(1);
  }

  process.stdout.write(`Azure: Checking subscription ${config.azure.subscriptionId}...\n`);

  const client = new AzureCostClient(config.azure);
  const result = await client.validate();

  if (result.connected) {
    process.stdout.write(`Azure: Connected (${result.detail})\n`);
  } else {
    process.stdout.write(`Azure: Failed (${result.detail})\n`);
    process.exit(1);
  }
}
