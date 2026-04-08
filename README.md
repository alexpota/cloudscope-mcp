# CloudScope MCP

> Ask your AI about your cloud bill.

[![npm version](https://img.shields.io/npm/v/cloudscope-mcp)](https://www.npmjs.com/package/cloudscope-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-io.github.alexpota%2Fcloudscope-blue)](https://registry.modelcontextprotocol.io/v0/servers?search=cloudscope)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Install

| Claude Code | Cursor | VS Code |
|-------------|--------|---------|
| `claude mcp add cloudscope -- npx -y cloudscope-mcp` | [Install](https://cursor.com/en/install-mcp?name=cloudscope&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImNsb3Vkc2NvcGUtbWNwIl0sImVudiI6eyJBWlVSRV9TVUJTQ1JJUFRJT05fSUQiOiJ5b3VyLXN1YnNjcmlwdGlvbi1pZCJ9fQ==) | [Install](https://insiders.vscode.dev/redirect/mcp/install?name=cloudscope&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImNsb3Vkc2NvcGUtbWNwIl0sImVudiI6eyJBWlVSRV9TVUJTQ1JJUFRJT05fSUQiOiJ5b3VyLXN1YnNjcmlwdGlvbi1pZCJ9fQ==) |

## What It Does

CloudScope gives AI assistants read-only access to your Azure cost data. Ask about spending, find anomalies, get optimization recommendations, and forecast next month's bill — all through natural language.

## Supported Providers

| Provider | Status                                                                                          |
|----------|-------------------------------------------------------------------------------------------------|
| Azure    | ✅ Supported                                                                                    |
| GCP      | Coming soon                                                                                     |
| AWS      | Use [AWS's official server](https://github.com/awslabs/mcp/tree/main/src/billing-cost-management-mcp-server) |

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed and logged in (`az login`)
- Your subscription ID (`az account show --query id -o tsv`)
- **Cost Management Reader** role on the subscription

## Configuration

Add to your MCP client config (`claude_desktop_config.json`, Cursor settings, etc.):

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

No service principal needed for local development. [`DefaultAzureCredential`](https://learn.microsoft.com/en-us/javascript/api/@azure/identity/defaultazurecredential) picks up your `az login` session automatically.

<details>
<summary>Advanced: Service Principal (CI/CD & automated environments)</summary>

| Variable              | Description                    |
|-----------------------|--------------------------------|
| `AZURE_TENANT_ID`     | Azure AD tenant ID             |
| `AZURE_CLIENT_ID`     | App registration client ID     |
| `AZURE_CLIENT_SECRET` | App registration client secret |

Set these alongside `AZURE_SUBSCRIPTION_ID` in the `env` block above.

</details>

## Tools

| Tool                       | Description                                    | Key Parameters                              |
|----------------------------|------------------------------------------------|---------------------------------------------|
| `get_cost_summary`         | Spending breakdown by service, group, or region | `start_date`, `end_date`, `group_by`        |
| `detect_anomalies`         | Find spending spikes vs previous period         | `days`, `threshold`                         |
| `list_recommendations`     | Azure Advisor cost optimization suggestions     | `category`                                  |
| `get_cost_forecast`        | Predict spending based on current trends        | `days`                                      |
| `check_budgets`            | Budget status, current spend, projected overage | _(none)_                                    |
| `compare_periods`          | Side-by-side cost comparison of two date ranges | `period_a_start/end`, `period_b_start/end`  |
| `top_spending_resources`   | Most expensive individual resources             | `days`, `limit`                             |
| `get_current_date`         | Today's date and current/previous month bounds  | _(none)_                                    |

## Example Prompts

- "How much did Azure cost last month?"
- "Show spending by resource group for the last 7 days"
- "Any cost anomalies this week?"
- "What will Azure cost next month?"
- "Show me cost optimization recommendations"
- "Which services had the biggest spend increase?"

## Security

CloudScope is read-only. It cannot create, modify, or delete any Azure resources. All API calls use Cost Management Reader permissions with no write access.

## FAQ

**Does this modify my Azure resources?** No. Read-only access only.

**Do I need a service principal?** No. `az login` works for local use.

**What about GCP?** Coming soon.

**Does the Azure Cost Management API cost money?** No. It's free.

## Development

```bash
git clone https://github.com/alexpota/cloudscope-mcp.git
cd cloudscope-mcp
npm install
npm run build
npm test
npx @modelcontextprotocol/inspector node dist/index.js
```

## License

[MIT](LICENSE)
