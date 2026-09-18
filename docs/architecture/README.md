# Architecture diagrams

## Editable diagrams

- `sales-companion-architecture.drawio` — two editable pages: Azure deployment architecture and component-level architecture.
- `sequence.mmd` — Mermaid sequence for Cowork/M365 dashboard, widget callback, preview, and confirmed simulated save.
- `CREDITS.md` — source and asset credits.

The `.drawio` source is the authoritative editable artifact. The architecture uses a single Azure Functions MCP boundary, Entra/Easy Auth, Blob-backed simulation, optional server-side upstream MCP, and Application Insights. Dashed paths are optional/configured; quote writes remain simulation-only.

## Review history

Initial pitch source created from the deployed PoC facts and current Azure component boundaries. Draw.io Iterate review records are maintained alongside the exported PNG when a renderer is available.
