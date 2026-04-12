import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { getConfig } from './config.js';
import { AzureCostClient } from './providers/azure/client.js';
import { GcpCostClient } from './providers/gcp/client.js';
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

// Normal MCP startup (includes auto-discovery if no subscription ID set)
const server = await createServer();
const transport = new StdioServerTransport();
await server.connect(transport);

async function validate(): Promise<void> {
  const config = getConfig();
  let anyConfigured = false;

  // Azure validation
  if (config.azure.subscriptionId) {
    anyConfigured = true;
    process.stdout.write(`Azure: Checking subscription ${config.azure.subscriptionId}...\n`);
    const client = new AzureCostClient(config.azure as typeof config.azure & { subscriptionId: string });
    const result = await client.validate();
    if (result.connected) {
      process.stdout.write(`Azure: Connected (${result.detail})\n`);
    } else {
      process.stdout.write(`Azure: Failed (${result.detail})\n`);
      process.exit(1);
    }
  } else {
    process.stdout.write('Azure: Not configured (set AZURE_SUBSCRIPTION_ID)\n');
  }

  // GCP validation
  if (config.gcp.projectId && config.gcp.billingTable) {
    anyConfigured = true;
    process.stdout.write(`GCP: Checking project ${config.gcp.projectId}...\n`);
    const client = new GcpCostClient(config.gcp);
    const result = await client.validate();
    if (result.connected) {
      process.stdout.write(`GCP: Connected (${result.detail})\n`);
    } else {
      process.stdout.write(`GCP: Failed (${result.detail})\n`);
      process.exit(1);
    }
  } else {
    process.stdout.write('GCP: Not configured (set GOOGLE_CLOUD_PROJECT and GCP_BILLING_TABLE)\n');
  }

  if (!anyConfigured) {
    process.exit(1);
  }
}
