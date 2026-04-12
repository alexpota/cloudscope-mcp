# CloudScope MCP

> Ask your AI about your cloud bill.

[![npm version](https://img.shields.io/npm/v/cloudscope-mcp)](https://www.npmjs.com/package/cloudscope-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-io.github.alexpota%2Fcloudscope-blue)](https://registry.modelcontextprotocol.io/v0/servers?search=cloudscope)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Install

| Claude Code                                          | Cursor                                                                                                                               | VS Code                                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude mcp add cloudscope -- npx -y cloudscope-mcp` | [Install](https://cursor.com/en/install-mcp?name=cloudscope&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImNsb3Vkc2NvcGUtbWNwIl19) | [Install](https://insiders.vscode.dev/redirect/mcp/install?name=cloudscope&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImNsb3Vkc2NvcGUtbWNwIl19) |

> Azure is auto-detected from your `az login` session. GCP requires BigQuery billing export setup (see below).

## What It Does

CloudScope gives AI assistants read-only access to your Azure and GCP cost data. Ask about spending, find anomalies, get optimization recommendations, and forecast next month's bill — all through natural language. Works across multiple subscriptions/projects, supports tag-based cost allocation, and includes five guided-workflow prompts for common FinOps tasks.

## Supported Providers

| Provider | Status                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| Azure    | ✅ Supported                                                                                                 |
| GCP      | ✅ Supported                                                                                                 |
| AWS      | Use [AWS's official server](https://github.com/awslabs/mcp/tree/main/src/billing-cost-management-mcp-server) |

## Prerequisites

### Azure

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed and logged in (`az login`)
- **Cost Management Reader** role on the subscription

### GCP

- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and logged in (`gcloud auth application-default login`)
- [Billing export to BigQuery](https://cloud.google.com/billing/docs/how-to/export-data-bigquery) enabled (the detailed export is recommended for resource-level cost queries)
- **BigQuery Data Viewer** + **BigQuery Job User** roles on the dataset project
- Note: BigQuery queries have a small cost (~$6.25/TB scanned, typically <$0.01 per query)

## Configuration

### Azure (zero-config)

CloudScope auto-detects your subscription from `az login`. Just add the server:

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

<details>
<summary>Advanced: Service Principal (CI/CD & automated environments)</summary>

| Variable              | Description                    |
| --------------------- | ------------------------------ |
| `AZURE_TENANT_ID`     | Azure AD tenant ID             |
| `AZURE_CLIENT_ID`     | App registration client ID     |
| `AZURE_CLIENT_SECRET` | App registration client secret |

Set these alongside `AZURE_SUBSCRIPTION_ID` in the `env` block above.

</details>

### GCP

GCP requires a BigQuery billing export table. Find your table name in **GCP Console > Billing > Billing export > BigQuery export**.

```json
{
  "mcpServers": {
    "cloudscope": {
      "command": "npx",
      "args": ["-y", "cloudscope-mcp"],
      "env": {
        "GCP_BILLING_TABLE": "my-project.my_dataset.gcp_billing_export_resource_v1_XXXXXX"
      }
    }
  }
}
```

`GOOGLE_CLOUD_PROJECT` is auto-set by `gcloud`. Override with `GCP_PROJECT_ID` if your billing dataset lives in a different project.

| Variable                         | Description                                               | Required |
| -------------------------------- | --------------------------------------------------------- | -------- |
| `GCP_BILLING_TABLE`              | Fully-qualified BigQuery table (`project.dataset.table`)  | Yes      |
| `GOOGLE_CLOUD_PROJECT`           | GCP project ID (auto-set by `gcloud`)                     | Yes      |
| `GCP_PROJECT_ID`                 | Override project ID if different from `GOOGLE_CLOUD_PROJECT` | No    |
| `GCP_BILLING_ACCOUNT_ID`         | Billing account ID for budget monitoring                  | No       |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON key file                     | No       |

## Tools

All tools accept a `provider` parameter (`azure` or `gcp`, default: `azure`).

**Cost Analysis**

| Tool                           | Description                                             | Key Parameters                               |
| ------------------------------ | ------------------------------------------------------- | -------------------------------------------- |
| `get_cost_summary`             | Spending breakdown by service, group, or region         | `start_date`, `end_date`, `group_by`         |
| `get_cost_by_tag`              | Costs grouped by a tag/label key                        | `tag_key`, `start_date`, `end_date`          |
| `compare_periods`              | Side-by-side cost comparison of two date ranges         | `period_a_start/end`, `period_b_start/end`   |
| `top_spending_resources`       | Most expensive individual resources                     | `days`, `limit`                              |
| `get_cross_subscription_costs` | Combined costs across Azure subscriptions               | `subscription_ids`, `start_date`, `end_date` |
| `get_cross_project_costs`      | Combined costs across GCP projects                      | `project_ids`, `start_date`, `end_date`      |

**Monitoring**

| Tool                | Description                                     | Key Parameters      |
| ------------------- | ----------------------------------------------- | ------------------- |
| `detect_anomalies`  | Find spending spikes vs previous period         | `days`, `threshold` |
| `check_budgets`     | Budget status, current spend, projected overage | _(none)_            |
| `get_cost_forecast` | Predict spending based on current trends        | `days`              |

**Optimization**

| Tool                      | Description                                             | Key Parameters |
| ------------------------- | ------------------------------------------------------- | -------------- |
| `list_recommendations`    | Cost optimization suggestions (Azure Advisor / GCP Recommender) | `category` |
| `find_idle_resources`     | Provisioned but unused resources with cost estimates    | _(none)_       |
| `find_untagged_resources` | Resources with no tags/labels (cost attribution gaps)   | _(none)_       |

**Utility**

| Tool                 | Description                                        | Key Parameters |
| -------------------- | -------------------------------------------------- | -------------- |
| `get_current_date`   | Today's date and current/previous month bounds     | _(none)_       |
| `list_subscriptions` | Azure subscriptions with active indicator          | _(none)_       |
| `list_projects`      | GCP projects with active indicator                 | _(none)_       |

## Prompts

Guided workflows that produce structured reports. All prompts accept an optional `provider` argument (`azure` or `gcp`). In **Claude Code**, type `/cloudscope:` to see all prompts. In **Claude Desktop**, click the `+` button → **Connectors** → **cloudscope**.

| Prompt                     | Description                                                                                                                             | Arguments                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `monthly-cost-review`      | Complete monthly review: spending, last-month comparison, anomalies, top resources, budgets, forecast, savings opportunities            | `provider` (optional)                        |
| `waste-audit`              | Find wasted spend: top resources, optimization recommendations, at-risk budgets, total potential savings                                | `provider` (optional)                        |
| `cost-spike-investigation` | Root-cause analysis for a cost increase: which services, which resources, trend vs one-time, recommended actions                        | `days` (optional), `provider` (optional)     |
| `executive-summary`        | Brief non-technical cost summary for leadership: spend, trend, budget status, top drivers, forecast, key recommendation                 | _(none)_                                     |
| `chargeback-report`        | Cost allocation by tag/label key for chargeback: spending per value, untagged resources, tagged vs untagged split, month-over-month     | `tag_key` (required), `provider` (optional)  |

## Example Questions

- "How much did Azure cost last month?"
- "Show GCP spending by service for the last 7 days"
- "Any cost anomalies this week on GCP?"
- "What will Azure cost next month?"
- "Show me cost optimization recommendations for GCP"
- "Compare Azure and GCP costs across all projects and subscriptions"

## Security

CloudScope is read-only. It cannot create, modify, or delete any cloud resources. Azure uses Cost Management Reader permissions. GCP uses BigQuery Data Viewer + Job User with no write access.

## FAQ

**Does this modify my cloud resources?** No. Read-only access only.

**Do I need a service principal?** No. `az login` (Azure) or `gcloud auth application-default login` (GCP) works for local use.

**Does the Azure Cost Management API cost money?** No. It's free.

**Do GCP BigQuery cost queries cost money?** Yes, but typically <$0.01 per query (~$6.25/TB scanned). Billing export tables are small.

**Can I use both Azure and GCP at the same time?** Yes. Configure both sets of env vars and CloudScope queries whichever provider you specify in each tool call.

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
