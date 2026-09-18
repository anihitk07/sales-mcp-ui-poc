# Architecture diagrams

## Final diagrams

### Azure deployment

![Azure deployment architecture showing M365/Cowork host rendering, Entra and Easy Auth, Azure Functions MCP tools and UI resource, Blob persistence, telemetry, and optional upstream CRM MCP.](sales-companion-architecture.png)

### Component architecture

![Component architecture showing the host bridge and widget, MCP registration, read and simulated-write tools, normalized data access, quote arithmetic and state services, and external dependencies.](sales-companion-components.png)

The editable `sales-companion-architecture.drawio` contains both pages. It is the authoritative final source and matches Pass 4.

## Supporting artifacts

- `sequence.mmd` — host-mediated Mermaid sequence for M365 or Cowork, widget callbacks, preview, and confirmed simulated save.
- `sales-companion-architecture-{pitch,pass1..pass4}.drawio` — editable pitch and iteration evidence.
- Matching `sales-companion-architecture-*.png` and `sales-companion-components-*.png` — per-pass exports.
- `ITERATE-REVIEW.md` — measured four-pass review record.
- `CREDITS.md` — provenance, tooling, and asset statement.

The deployment diagram distinguishes Entra token issuance from Function App Easy Auth enforcement and Function managed identity. The component diagram separates host/UI, Function code, and dependencies. Brown dashed paths are optional; quote persistence is simulation-only. The red identity note is a production gate, not a claim that per-user isolation has already been proven.
