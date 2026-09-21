# Sales MCP Companion: Runtime, Deployment, and Packaging

This document explains how the Microsoft 365 agent, Azure Function App, remote
MCP handlers, and MCP Apps UI fit together, followed by the deployment and
packaging artifacts used by the proof of concept.

## Runtime flow

### Initial dashboard rendering

1. The user asks the Microsoft 365 Copilot declarative agent for a dashboard,
   opportunity, or quote.
2. The agent selects one of the configured MCP tools:
   `get_sales_dashboard`, `get_opportunity`, `preview_quote`,
   `save_demo_quote`, or `get_demo_quote`.
3. Microsoft 365 sends an authenticated MCP `tools/call` request to the
   deployed Azure Functions endpoint:

   ```text
   https://func-api-3hzb2nt3ps5ki.azurewebsites.net/runtime/webhooks/mcp
   ```

4. Azure Functions hosts the remote MCP server. There is no separate
   Azure Function-to-MCP-server hop: the MCP handlers run inside the Function
   App.
5. The selected handler executes in `src/functions/salesMcpApp.ts`.
6. The sales-data layer chooses the configured provider:
   - `DATA_MODE=synthetic` uses deterministic demo records.
   - `DATA_MODE=mcp` calls the server-side `CRM_MCP_URI` read-only MCP server.
7. The handler returns a short text summary, validated `structuredContent`, and
   metadata referencing:

   ```text
   ui://sales/workspace.html
   ```

8. Microsoft 365 sees that UI binding in each pinned tool's `_meta.ui.resourceUri`
   declaration.
9. Microsoft 365 separately issues an MCP `resources/read` request for the UI
   resource.
10. Azure Functions returns the bundled resource with MIME type:

    ```text
    text/html;profile=mcp-app
    ```

11. Microsoft 365 mounts the returned HTML in a host-controlled sandboxed
    widget and delivers the tool result to it.
12. The bundled widget renders KPI cards, the opportunity table, pipeline and
    stage charts, filters, opportunity details, and quote controls.

The tool result and the UI resource are separate MCP operations. The Function
does not return HTML and data as one combined payload.

### Interactive callbacks

For widget actions such as opening an opportunity or previewing a quote:

```text
Widget
  -> app.callServerTool(...)
  -> Microsoft 365 MCP host
  -> Azure Functions MCP handler
  <- structured tool result
  <- Microsoft 365 MCP host
  <- Widget update
```

The widget does not directly contact Azure, Blob Storage, the CRM MCP server,
or any credential-bearing endpoint.

### Quote workflow

Preview:

```text
Widget
  -> callServerTool(preview_quote)
  -> Microsoft 365 host
  -> Azure Functions
  -> quoteService
  -> quoteMath
  -> identity-scoped Blob draft
  -> server-calculated preview
  -> Microsoft 365 host
  -> Widget
```

Simulated save:

1. The user explicitly confirms the simulated save in the widget.
2. The host may request an additional confirmation for the side-effecting
   operation.
3. Azure Functions requires the exact token
   `CONFIRM_SIMULATED_SAVE`.
4. The server validates the draft revision and idempotency key.
5. The server writes only to the `sales-quotes` Blob container.
6. The widget receives a `SIMULATED` quote reference.

The proof of concept has no CRM write path.

## Azure deployment artifact

The Azure project is the repository root. `azure.yaml` identifies it as a
TypeScript Azure Functions service:

```yaml
services:
  api:
    project: .
    language: ts
    host: function
    remoteBuild: true
```

The build produces two runtime outputs:

```powershell
npm run build:app
npm run build
```

- `npm run build:app` uses Vite to produce the single-file MCP Apps bundle at
  `src/app/dist/index.html`.
- `npm run build` compiles the TypeScript Function code to `dist/`.

`npm test` performs the application build, server compilation, and Node test
run before deployment.

The deployment flow is:

```powershell
azd provision
azd deploy
```

`azd provision` creates or updates the infrastructure defined under `infra/`.
That includes the Function App, storage, managed identity, authentication,
Application Insights, and deployment storage.

`azd deploy` packages the Function project and deploys it to Azure. Because
`remoteBuild: true` is configured, Azure performs the deployment build rather
than requiring a local `node_modules` directory to be shipped.

`.funcignore` excludes development-only content such as `node_modules`,
`local.settings.json`, tests, Azurite files, source maps, and Git metadata.

The Azure deployment artifact is therefore:

```text
compiled Function code
+ bundled MCP Apps HTML
+ Function/runtime metadata
+ server dependencies resolved by the deployment build
```

It is not the Microsoft 365 agent package.

## Microsoft 365 package

The Microsoft 365 package is under `appPackage/`:

| File | Purpose |
| --- | --- |
| `manifest.json` | Microsoft 365/Teams application manifest |
| `declarativeAgent.json` | Agent name, instructions, starters, and actions |
| `instruction.txt` | Agent operating instructions |
| `ai-plugin.json` | Remote MCP endpoint, exposed tools, and OAuth configuration |
| `mcp-tools.json` | Pinned tool schemas and UI-resource bindings |
| `color.png` | Full-colour application icon |
| `outline.png` | Outline application icon |

This package does not contain the compiled dashboard HTML. It tells Microsoft
365 where the deployed MCP server is and how to retrieve the
`ui://sales/workspace.html` resource at runtime.

## Agents Toolkit

Microsoft 365 Agents Toolkit 6.12.0 or later is used for the Microsoft 365
package lifecycle. It is not part of the production runtime and is not required
to execute the Azure Function.

The checked-in `m365agents.yml` provisions:

```yaml
uses: teamsApp/create
uses: oauth/register
```

The toolkit is used to assist with:

1. Microsoft 365 application registration;
2. OAuth configuration;
3. environment placeholder resolution;
4. package validation;
5. package creation and test sideloading.

Azure deployment and Microsoft 365 package deployment are separate toolchains:

```text
Azure Developer CLI
  -> Function App, MCP handlers, bundled HTML, and Azure resources

Microsoft 365 Agents Toolkit
  -> agent manifest, MCP endpoint metadata, OAuth registration, and sideload
```

The repository does not use a CLI named `a365`. Tenant-wide publication through
the Microsoft 365 Admin Center is a later distribution step after package
validation, publisher metadata review, and tenant approval.

## Related implementation files

- `src/functions/salesMcpApp.ts` — MCP tools and HTML resource registration.
- `src/functions/salesData.ts` — synthetic or configured upstream MCP reads.
- `src/functions/quoteService.ts` — quote orchestration and validation.
- `src/functions/quoteStore.ts` — identity-scoped Blob persistence.
- `src/app/src/sales-app.ts` — interactive widget and server-tool callbacks.
- `azure.yaml` — Azure Developer CLI service definition.
- `.funcignore` — Function deployment exclusions.
- `appPackage/` — Microsoft 365 declarative-agent package.
- `m365agents.yml` — Agents Toolkit provisioning workflow.
