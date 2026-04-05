# CloudScope MCP

> Ask your AI about your cloud bill.

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that gives AI coding agents real-time access to cloud cost data for Azure (GCP coming soon). Works with Claude Code, Claude Desktop, Cursor, Windsurf, and any MCP-compatible client.

## Features

- **Cost Summary** — spending breakdown by service, resource group, or region for any date range
- **Anomaly Detection** — find spending spikes by comparing current period to previous period
- **Optimization Recommendations** — surface cost-saving opportunities from Azure Advisor

## Supported Providers

| Provider | Status |
|----------|--------|
| Azure | ✅ Supported |
| GCP | 🚧 Coming soon |
| AWS | ❌ Use AWS's official server |

## Quick Start

### Claude Code

```bash
claude mcp add cloudscope -- npx -y cloudscope-mcp
```

### Claude Desktop / Cursor / Windsurf

Add to your MCP client config (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cloudscope": {
      "command": "npx",
      "args": ["-y", "cloudscope-mcp"],
      "env": {
        "AZURE_SUBSCRIPTION_ID": "your-subscription-id"
      }
    }
  }
}
```

## Azure Setup

### Required

| Variable                | Description                  |
| ----------------------- | ---------------------------- |
| `AZURE_SUBSCRIPTION_ID` | Target Azure subscription ID |

### Optional (for service principal auth)

| Variable              | Description                    |
| --------------------- | ------------------------------ |
| `AZURE_TENANT_ID`     | Azure AD tenant ID             |
| `AZURE_CLIENT_ID`     | App registration client ID     |
| `AZURE_CLIENT_SECRET` | App registration client secret |

If the optional variables are not set, authentication falls back to [`DefaultAzureCredential`](https://learn.microsoft.com/en-us/javascript/api/@azure/identity/defaultazurecredential), which supports Azure CLI (`az login`), managed identity, and other methods.

**Required Azure role:** Cost Management Reader on the subscription.

## Tools

### `get_cost_summary`

Get cloud spending breakdown by service, resource group, or region for any date range.

| Parameter    | Type                                               | Default   | Description             |
| ------------ | -------------------------------------------------- | --------- | ----------------------- |
| `provider`   | `azure` \| `gcp`                                   | required  | Cloud provider to query |
| `start_date` | `string`                                           | required  | Start date (YYYY-MM-DD) |
| `end_date`   | `string`                                           | required  | End date (YYYY-MM-DD)   |
| `group_by`   | `service` \| `resource_group` \| `tag` \| `region` | `service` | How to group costs      |

### `detect_anomalies`

Find spending spikes by comparing current period to previous period.

| Parameter   | Type             | Default  | Description                               |
| ----------- | ---------------- | -------- | ----------------------------------------- |
| `provider`  | `azure` \| `gcp` | required | Cloud provider to query                   |
| `days`      | `number`         | `7`      | Compare last N days to N days before that |
| `threshold` | `number`         | `20`     | Percentage increase to flag as anomaly    |

### `list_recommendations`

Get cost optimization recommendations from the cloud provider.

| Parameter  | Type                                            | Default  | Description             |
| ---------- | ----------------------------------------------- | -------- | ----------------------- |
| `provider` | `azure` \| `gcp`                                | required | Cloud provider to query |
| `category` | `all` \| `compute` \| `storage` \| `networking` | `all`    | Filter by category      |

## Example Usage

Once configured, ask your AI assistant:

- "How much did Azure cost last month?"
- "Show me spending by resource group for the last 7 days"
- "Are there any cost anomalies in the last week?"
- "What cost optimization recommendations does Azure have?"

## Configuration

### Environment Variables

```bash
# Azure (required for Azure tools)
AZURE_SUBSCRIPTION_ID=          # Target subscription
AZURE_TENANT_ID=                # Azure AD tenant ID (optional)
AZURE_CLIENT_ID=                # App registration client ID (optional)
AZURE_CLIENT_SECRET=            # App registration secret (optional)

# Server config
CACHE_TTL_SECONDS=300           # Cache TTL in seconds (default: 300)
LOG_LEVEL=info                  # Log level (default: info)
```

## Development

```bash
git clone https://github.com/alexpota/cloudscope-mcp.git
cd cloudscope-mcp
npm install
npm run build
npm test
```

### Test with MCP Inspector

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

## License

[MIT](LICENSE)
