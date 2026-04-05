# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-05

### Added

- MCP server with stdio transport using `@modelcontextprotocol/sdk` v1.29+
- **`get_cost_summary`** tool — cloud spending breakdown by service, resource group, or region for any date range
- **`detect_anomalies`** tool — find spending spikes by comparing current period to previous period
- **`list_recommendations`** tool — cost optimization recommendations from Azure Advisor
- Azure provider using `@azure/arm-costmanagement`, `@azure/arm-advisor`, and `@azure/identity`
- Support for both service principal and Azure CLI authentication via `DefaultAzureCredential`
- In-memory TTL cache (default 5 minutes) to avoid rate limits
- LLM-friendly text table output format with totals, percentages, and daily averages
- Graceful error messages when providers are not configured
- Tail-item collapsing for cost tables with more than 10 line items

[0.1.0]: https://github.com/alexpota/cloudscope-mcp/releases/tag/v0.1.0
