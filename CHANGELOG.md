# Changelog

## 0.3.0 (2026-04-12)

- **GCP support**: Google Cloud Platform cost management via BigQuery billing exports, GCP Recommender, Cloud Asset Inventory, and Budget API
- **Multi-provider architecture**: 14 shared tools accept `provider` parameter with auto-detected default
- **New tools**: `list_projects`, `get_cross_project_costs` — 16 tools total
- **GroupByKey normalization**: Provider-agnostic grouping keys translated internally per provider
- **Linear forecast utility**: Client-side cost forecasting for providers without native forecast APIs
- **Provider-aware prompts**: 5 guided-workflow prompts accept optional `provider` argument
- **Dynamic server instructions**: MCP instructions reflect configured providers
- **275 tests** across 34 test files

## 0.2.0 (2026-04-10)

- Subscription auto-discovery from `az login` session
- Cross-subscription cost queries
- Tag-based cost allocation (`get_cost_by_tag`)
- Idle resource detection (unattached disks, orphaned NICs, unused IPs, empty App Service plans)
- Untagged resource detection
- `list_subscriptions` tool
- Chargeback report prompt
- 209 tests across 29 test files

## 0.1.5 (2026-04-09)

- Five guided-workflow prompts (monthly review, waste audit, spike investigation, executive summary, chargeback)
- MCP server instructions for tool relationship guidance
- Improved tool descriptions for Glama directory scores
- tsup build (77 npm files → 7, ~35KB bundle)

## 0.1.4 (2026-04-08)

- Budget monitoring (`check_budgets`)
- Cost comparison tool (`compare_periods`)
- Anomaly detection with configurable threshold

## 0.1.3 (2026-04-08)

- Cost forecast tool
- Top spending resources tool
- Recommendation categories (compute, storage, networking)

## 0.1.2 (2026-04-07)

- Azure Advisor integration (`list_recommendations`)
- Formatted ASCII table output
- Error handling with `withProvider` pattern

## 0.1.1 (2026-04-07)

- Date validation before API calls
- Cache with request coalescing
- Rate limiting with exponential backoff

## 0.1.0 (2026-04-06)

- Initial release
- Azure cost summary by service, resource group, or region
- Cost anomaly detection
- Azure Advisor optimization recommendations
- Cost forecasting
- Budget monitoring
- Period-over-period cost comparison
- Top spending resources
- Date helper for accurate LLM queries
