---
page_type: sample
languages:
- typescript
- bicep
products:
- azure
urlFragment: sales-mcp-ui-poc
name: sales-mcp-ui-poc
description: "An Azure Functions Remote MCP TypeScript application that renders one bundled MCP Apps workspace for this flow:"
---

# Sales companion MCP Apps PoC

An Azure Functions Remote MCP TypeScript application that renders one bundled MCP Apps workspace for this flow:

`sales dashboard -> opportunity detail -> editable quote preview -> explicitly confirmed SIMULATED quote save`

The PoC never writes to CRM. Dashboard and opportunity reads use deterministic synthetic data by default or a server-configured read-only MCP server. The dashboard includes responsive, accessible pipeline bar and stage-mix donut charts alongside the detailed table. Quote drafts and simulated saves are persisted in Azure Blob Storage.

## Prerequisites

- Node.js 22
- Azure Functions Core Tools 4.0.7030 or later
- Azurite for local Blob/queue storage
- Azure Developer CLI (`azd`) for the parent-managed deployment flow
- Microsoft 365 Agents Toolkit 6.12.0 or later for sideloading

## Setup, build, and test

```powershell
Set-Location C:\Flutter\sales-mcp-ui-poc
npm install
npm test
```

`npm test` builds the single-file UI, compiles the server and tests, and runs the Node built-in test entry point. To build without tests:

```powershell
npm run build:app
npm run build
```

## Local run

Start Azurite first. The checked-in `local.settings.json` uses `UseDevelopmentStorage=true`, contains no credentials, and defaults to synthetic data.

```powershell
Set-Location C:\Flutter\sales-mcp-ui-poc
npm start
```

MCP endpoint:

```text
http://localhost:7071/runtime/webhooks/mcp
```

The Functions MCP extension requires the existing `host.json` configuration, including `webhookAuthorizationLevel: Anonymous`. In Azure, App Service Authentication/Easy Auth still requires an authenticated Entra token before the request reaches the Functions host.

## Configuration

| Setting | Values/default | Purpose |
| --- | --- | --- |
| `DATA_MODE` | `synthetic` or `mcp`; default `synthetic` | Selects dashboard/opportunity source. Invalid values fail explicitly. |
| `CRM_MCP_URI` | Empty by default | Server-side Streamable HTTP MCP endpoint used only when `DATA_MODE=mcp`. The browser cannot set or choose it. |
| `SALES_QUOTE_CONTAINER` | `sales-quotes` | Blob container for drafts and simulated saved quotes. |
| `POC_IDENTITY_FALLBACK` | `poc-local-anonymous` locally | Clearly labelled scope used only when a trusted authenticated principal ID is unavailable. |
| `AzureWebJobsStorage` | `UseDevelopmentStorage=true` locally | Azurite connection string. Do not commit real credentials. |
| `AzureWebJobsStorage__blobServiceUri` | Set by Bicep in Azure | Existing storage account Blob endpoint. |
| `AzureWebJobsStorage__clientId` | Set by Bicep in Azure | Existing user-assigned managed identity client ID. |

### Data modes

**Synthetic mode** returns stable IDs:

- `opp-contoso-expansion`
- `opp-fabrikam-pilot`
- `opp-northwind-renewal`

Every response is labelled **Synthetic demo data** and **Simulation - not CRM**.

**MCP mode** uses the official `@modelcontextprotocol/sdk` `Client` with `StreamableHTTPClientTransport`. The upstream allowlist is fixed to:

- `get_sales_dashboard` with no arguments
- `get_opportunity` with `{ "opportunityId": "..." }`

The upstream must return normalized integer-cent and basis-point fields matching `src/functions/salesData.ts`, through `structuredContent` or JSON text. Connection, tool, schema, and parsing errors are returned explicitly; there is no synthetic fallback.

Example local override:

```powershell
$env:DATA_MODE = "mcp"
$env:CRM_MCP_URI = "http://localhost:3001/mcp"
npm start
```

## Public MCP surface

| Tool | Behavior |
| --- | --- |
| `get_sales_dashboard` | Read-only dashboard. |
| `get_opportunity` | Read-only opportunity and fixed quote catalog. |
| `preview_quote` | Creates or revises an identity-scoped Blob-backed draft. |
| `save_demo_quote` | Requires the exact `CONFIRM_SIMULATED_SAVE` token, draft/revision, and an idempotency key; saves only a SIMULATED quote. |
| `get_demo_quote` | Reads a saved simulated quote. |

All tools point to `ui://sales/workspace.html`, served as `text/html;profile=mcp-app`. Read tools advertise `readOnlyHint`. Tool responses include text plus `structuredContent`.

## Quote persistence and identity

Money is stored as integer cents and discounts as integer basis points. A preview creates server revision 1; editing requires the exact current revision and increments it using Blob ETag optimistic concurrency. Save uses a deterministic quote ID derived from the draft and conditional Blob creation. Repeating the same revision and idempotency key returns the original saved record.

Blob paths are scoped by a SHA-256 hash of a trusted principal ID when the Functions trigger exposes one. Anonymous/local hosts often do not expose a principal, so the PoC uses the labelled `POC_IDENTITY_FALLBACK`. **Production is blocked until a Microsoft 365 authenticated call proves that the expected Entra principal reaches `InvocationContext.triggerMetadata` and produces per-user isolation.**

The existing Bicep storage account and user-assigned managed identity are reused. The existing RBAC module grants Blob Data Owner and Queue Data Contributor as required by the template. Bicep declares the `sales-quotes` container; no new infrastructure stack is introduced.

## Azure deployment flow

The parent workflow owns validation and deployment. This project is prepared for:

```powershell
azd env new <environment-name>
azd env set PRE_AUTHORIZED_CLIENT_IDS <approved-client-id-list>
azd env set VNET_ENABLED false
azd provision
azd deploy
```

The deployed endpoint is:

```text
https://func-api-3hzb2nt3ps5ki.azurewebsites.net/runtime/webhooks/mcp
```

To switch the deployed app to a read-only CRM MCP source, set `DATA_MODE=mcp` and `CRM_MCP_URI` as server-side Function App settings through the approved deployment/configuration process. Do not expose `CRM_MCP_URI` to the app UI.

## Microsoft 365 package

`appPackage` contains a declarative agent and a pinned `RemoteMCPServer` plugin with only the five PoC tools. The deployed package uses Entra application `d22d3dce-f56f-4a9a-bf08-5d02412cf2a0` and an Enterprise token-store Entra SSO configuration created by Agents Toolkit. The generated Application ID URI is `api://auth-0e8e3566-ac5e-4e00-b19e-7731a1d65d55/d22d3dce-f56f-4a9a-bf08-5d02412cf2a0`.

The package passed all 61 Agents Toolkit validation rules and was installed in the test tenant (Title ID `T_2064f322-b040-883c-9e43-c0da44867a24`). The chart-enabled UI bundle is deployed to the existing Function App; the M365 package did not require a manifest change. One interactive user consent/invocation in an authenticated M365 Copilot session remains required to prove inline rendering and per-user identity. Replace publisher URLs/contact values before broader distribution.

## Copilot Cowork skills

`cowork/` contains a Unified App Manifest, MCP tool descriptions, and three portable Agent Skills inspired by the L2Q Cowork package structure:

- `pipeline-review-pack` — reconciled pipeline analysis plus optional Excel workbook, PowerPoint narrative, and executive email draft.
- `opportunity-research-brief` — grounded Word meeting brief and optional email draft without invented contacts or activity.
- `simulated-quote-review` — server-calculated quote preview, optional Word review, and explicitly confirmed simulated save.

The package uses the same five MCP tools as the M365 declarative agent. Replace the endpoint and OAuth token-store reference in `cowork/manifest.json` before upload; never place credentials in the skill files. Build it with:

```powershell
Set-Location C:\Flutter\sales-mcp-ui-poc
.\cowork\scripts\package.ps1
```

Cowork skills are instructions that orchestrate connector tools; they are not an authorization boundary. Server-side validation, ownership checks, the exact `CONFIRM_SIMULATED_SAVE` token, current revision, and idempotency key remain mandatory. Cowork MCP Apps may render the same `ui://sales/workspace.html` resource, but host capability and confirmation behavior must be verified in the target tenant.

## Architecture artifacts

- [Azure deployment diagram](docs/architecture/sales-companion-architecture.png) and [editable Draw.io source](docs/architecture/sales-companion-architecture.drawio)
- [Component architecture diagram](docs/architecture/sales-companion-components.png)
- [Mermaid sequence](docs/architecture/sequence.mmd)
- [Draw.io review record](docs/architecture/ITERATE-REVIEW.md) — final artifact only; intermediate passes were not retained

The diagrams distinguish Entra token issuance, Easy Auth enforcement, Function managed identity, host-mediated widget rendering, optional upstream CRM MCP access, and the unproven per-user identity-isolation production gate.

## Security caveats

- This is a PoC, not a CRM write integration.
- `save_demo_quote` is state-changing only within the simulation Blob container.
- The remote CRM tool contract is read-only and hardcoded.
- The MCP URI is server-side configuration only.
- Easy Auth and the existing Entra template must remain enabled for deployed use.
- M365-to-Functions identity propagation is a production gate, not an assumption.
- Synthetic data must not be represented as real customer or pipeline data.
- No real credentials belong in `local.settings.json`, manifests, or source.

## Cleanup

Azure resources and the installed M365 app are intentionally preserved for user verification. Local dependency and runtime cache directories are removed after final validation; restore dependencies with `npm ci`. Do not run `azd down` until the user explicitly approves deletion.

## Trademarks

This project may contain trademarks or logos for projects, products, or services.
Authorized use of Microsoft trademarks or logos is subject to and must follow
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not
cause confusion or imply Microsoft sponsorship. Any use of third-party trademarks or
logos are subject to those third-party's policies.
