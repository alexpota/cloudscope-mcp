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

> Subscription is auto-detected from your `az login` session. Set `AZURE_SUBSCRIPTION_ID` to override.

## What It Does

CloudScope gives AI assistants read-only access to your Azure cost data. Ask about spending, find anomalies, get optimization recommendations, and forecast next month's bill — all through natural language. Includes four guided-workflow prompts for common tasks (monthly reviews, waste audits, spike investigations, executive summaries).

## Supported Providers

| Provider | Status                                                                                          |
|----------|-------------------------------------------------------------------------------------------------|
| Azure    | ✅ Supported                                                                                    |
| GCP      | Coming soon                                                                                     |
| AWS      | Use [AWS's official server](https://github.com/awslabs/mcp/tree/main/src/billing-cost-management-mcp-server) |

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed and logged in (`az login`)
- Your subscription ID (optional — auto-detected from `az login` if not set)
- **Cost Management Reader** role on the subscription

## Configuration

CloudScope auto-detects your subscription from `az login`. Just add the server to your MCP client:

```json
{
  "mcpServers": {
    "cloudscope": {
      "command": "npx",
      "args": ["-y", "cloudscope-mcp"]
    }
  }
}
```

To target a specific subscription, add an `env` block:

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

**Cost Analysis**

| Tool | Description | Key Parameters |
|---|---|---|
| `get_cost_summary` | Spending breakdown by service, group, or region | `start_date`, `end_date`, `group_by` |
| `get_cost_by_tag` | Costs grouped by a tag key (team, environment, project) | `tag_key`, `start_date`, `end_date` |
| `compare_periods` | Side-by-side cost comparison of two date ranges | `period_a_start/end`, `period_b_start/end` |
| `top_spending_resources` | Most expensive individual resources | `days`, `limit` |
| `get_cross_subscription_costs` | Combined costs across multiple subscriptions | `subscription_ids`, `start_date`, `end_date` |

**Monitoring**

| Tool | Description | Key Parameters |
|---|---|---|
| `detect_anomalies` | Find spending spikes vs previous period | `days`, `threshold` |
| `check_budgets` | Budget status, current spend, projected overage | _(none)_ |
| `get_cost_forecast` | Predict spending based on current trends | `days` |

**Optimization**

| Tool | Description | Key Parameters |
|---|---|---|
| `list_recommendations` | Azure Advisor cost optimization suggestions | `category` |
| `find_idle_resources` | Unattached disks, orphaned NICs, unused IPs, empty App Service plans | _(none)_ |
| `find_untagged_resources` | Resources with no tags (cost attribution gaps) | _(none)_ |

**Utility**

| Tool | Description | Key Parameters |
|---|---|---|
| `get_current_date` | Today's date and current/previous month bounds | _(none)_ |
| `list_subscriptions` | All accessible subscriptions with active indicator | _(none)_ |

## Prompts

Guided workflows that produce structured reports. In **Claude Code**, type `/cloudscope:` to see all prompts. In **Claude Desktop**, click the `+` button → **Connectors** → **cloudscope**. Other MCP clients surface prompts differently — check your client's docs.

| Prompt                      | Description                                                                    | Arguments                       |
|-----------------------------|--------------------------------------------------------------------------------|---------------------------------|
| `monthly-cost-review`       | Complete monthly review: spending, last-month comparison, anomalies, top resources, budgets, forecast, savings opportunities | _(none)_                        |
| `waste-audit`               | Find wasted spend: top expensive resources, Azure Advisor recommendations, at-risk budgets, total potential savings | _(none)_                        |
| `cost-spike-investigation`  | Root-cause analysis for a cost increase: which services, which resources, trend vs one-time, recommended actions | `days` (optional, default `7`)  |
| `executive-summary`         | Brief non-technical cost summary for leadership: spend, trend, budget status, top drivers, forecast, key recommendation | _(none)_                        |
| `chargeback-report`         | Cost allocation by tag key for chargeback: spending per tag value, untagged resources, tagged vs untagged split, month-over-month trend | `tag_key` (required)            |

## Example Questions

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
