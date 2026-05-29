# CloudScope MCP

> Ask your AI about your cloud bill.

[![npm version](https://img.shields.io/npm/v/cloudscope-mcp)](https://www.npmjs.com/package/cloudscope-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-io.github.alexpota%2Fcloudscope-blue)](https://glama.ai/mcp/servers/alexpota/cloudscope-mcp)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## What you get

Ask once: **"Give me this month's cost review"** — and CloudScope runs the full
workflow (spend, deltas, anomalies, idle resources, budgets, forecast) and hands
back a decision-ready report, not raw numbers to interpret yourself:

> ## TL;DR
> Month-to-date Azure spend is **$4,312** (May 1–29), tracking **+11% vs April**.
> The mover is **App Service (+$280)** — a new staging slot left running.
> **2 idle resources cost $94/month**; `prod-budget` is at **78%** with 2 days left.
> Top action: **delete the orphaned managed disk → save $63/month.**
>
> ## Spend This Month
> | Service          | Cost     | % |
> |------------------|----------|------|
> | Virtual Machines | $2,140   | 49.6% |
> | App Service      | $890     | 20.6% |
> | Storage          | $612     | 14.2% |
> | Redis Cache      | $410     | 9.5% |
> | Networking       | $260     | 6.0% |
>
> ## vs Last Month
> **+$427 (+11%)** overall. App Service **+$280** drove most of it; everything
> else flat. → *new `staging-slot-2`, created May 12, never torn down.*
>
> ## Idle & Wasted Resources
> | Resource              | Type        | $/month |
> |-----------------------|-------------|---------|
> | `orphaned-osdisk-01`  | Managed Disk| $63 |
> | `old-lb-ip`           | Public IP   | $31 |
>
> ## Budget Status
> `prod-budget` — **78% used**, $4,312 / $5,500, on track (2 days left).
>
> ## Recommended Actions
> 1. Delete `orphaned-osdisk-01` (unattached 40 days) → **$63/month**
> 2. Tear down `staging-slot-2` if staging is idle → **~$280/month**
> 3. Release `old-lb-ip` (no binding) → **$31/month**

*Illustrative example showing the report format. Run `/cloudscope:monthly-cost-review` against your own subscription for live numbers.*

## Install

| Claude Code                                          | Cursor                                                                                                                               | VS Code                                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude mcp add cloudscope -- npx -y cloudscope-mcp` | [Install](https://cursor.com/en/install-mcp?name=cloudscope&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImNsb3Vkc2NvcGUtbWNwIl19) | [Install](https://insiders.vscode.dev/redirect/mcp/install?name=cloudscope&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImNsb3Vkc2NvcGUtbWNwIl19) |

> Azure is auto-detected from your `az login` session. GCP requires BigQuery billing export setup (see below).

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
- [Billing export to BigQuery](https://cloud.google.com/billing/docs/how-to/export-data-bigquery) enabled — this is a one-time manual setup step, not enabled by default (the detailed export is recommended for resource-level cost queries)
- **BigQuery Data Viewer** + **BigQuery Job User** roles on the dataset project
- Note: BigQuery on-demand queries cost $6.25 per TiB scanned ([pricing](https://cloud.google.com/bigquery/pricing)). The first 1 TiB/month is free. Billing export tables are small — typical CloudScope queries cost <$0.01 each.

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
        "GOOGLE_CLOUD_PROJECT": "my-project",
        "GCP_BILLING_TABLE": "my-project.my_dataset.gcp_billing_export_resource_v1_XXXXXX"
      }
    }
  }
}
```

Set `GOOGLE_CLOUD_PROJECT` to your GCP project ID. Override with `GCP_PROJECT_ID` if your billing dataset lives in a different project.

These variables apply only when using GCP; Azure-only users can skip them.

| Variable                         | Description                                               | Required |
| -------------------------------- | --------------------------------------------------------- | -------- |
| `GOOGLE_CLOUD_PROJECT`           | GCP project ID                                            | Yes      |
| `GCP_BILLING_TABLE`              | Fully-qualified BigQuery table (`project.dataset.table`)  | Yes      |
| `GCP_PROJECT_ID`                 | Override project ID if different from `GOOGLE_CLOUD_PROJECT` | No    |
| `GCP_BILLING_ACCOUNT_ID`         | Billing account ID for budget monitoring                  | No       |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON key file                     | No       |

### Both Providers

```json
{
  "mcpServers": {
    "cloudscope": {
      "command": "npx",
      "args": ["-y", "cloudscope-mcp"],
      "env": {
        "AZURE_SUBSCRIPTION_ID": "your-subscription-id",
        "GOOGLE_CLOUD_PROJECT": "my-project",
        "GCP_BILLING_TABLE": "my-project.my_dataset.gcp_billing_export_resource_v1_XXXXXX"
      }
    }
  }
}
```

Azure is auto-detected from `az login`. Add `AZURE_SUBSCRIPTION_ID` to target a specific subscription.

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

**Do GCP BigQuery cost queries cost money?** Yes, but typically <$0.01 per query ($6.25/TiB scanned, first 1 TiB/month free). See [BigQuery pricing](https://cloud.google.com/bigquery/pricing).

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

## Reference

### Tools

Most tools accept a `provider` parameter (`azure` or `gcp`); the provider-specific tools (`list_subscriptions`, `list_projects`, and the cross-account tools `get_cross_subscription_costs` / `get_cross_project_costs`) are fixed to their own cloud. The default provider is auto-detected based on which providers are configured.

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

### Prompts

Guided workflows that produce structured reports. All prompts accept an optional `provider` argument (`azure` or `gcp`). In **Claude Code**, type `/cloudscope:` to see all prompts. In **Claude Desktop**, click the `+` button → **Connectors** → **cloudscope**.

| Prompt                     | Description                                                                                                                             | Arguments                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `monthly-cost-review`      | Complete monthly review: spending, last-month comparison, anomalies, top resources, budgets, forecast, savings opportunities            | `provider` (optional)                        |
| `waste-audit`              | Find wasted spend: top resources, optimization recommendations, at-risk budgets, total potential savings                                | `provider` (optional)                        |
| `cost-spike-investigation` | Root-cause analysis for a cost increase: which services, which resources, trend vs one-time, recommended actions                        | `days` (optional), `provider` (optional)     |
| `executive-summary`        | Brief non-technical cost summary for leadership: spend, trend, budget status, top drivers, forecast, key recommendation                 | `provider` (optional)                        |
| `chargeback-report`        | Cost allocation by tag/label key for chargeback: spending per value, untagged resources, tagged vs untagged split, month-over-month     | `tag_key` (required), `provider` (optional)  |

## License

[MIT](LICENSE)
