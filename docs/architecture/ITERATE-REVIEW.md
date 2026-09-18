# Draw.io Iterate review record

Each review pass has its own two-page editable source and two matching PNG exports. All pages use an A5-landscape ratio (`1120 × 790`) and were exported with diagrams.net desktop v31.4.5.

## Evidence

| Stage | Editable source | Non-whitespace XML | Deployment PNG | Component PNG |
| --- | --- | ---: | --- | --- |
| Pitch | `sales-companion-architecture-pitch.drawio` | 2,860 | `sales-companion-architecture-pitch.png` | `sales-companion-components-pitch.png` |
| Pass 1 | `sales-companion-architecture-pass1.drawio` | 25,758 | `sales-companion-architecture-pass1.png` | `sales-companion-components-pass1.png` |
| Pass 2 | `sales-companion-architecture-pass2.drawio` | 24,011 | `sales-companion-architecture-pass2.png` | `sales-companion-components-pass2.png` |
| Pass 3 | `sales-companion-architecture-pass3.drawio` | 24,423 | `sales-companion-architecture-pass3.png` | `sales-companion-components-pass3.png` |
| Pass 4 | `sales-companion-architecture-pass4.drawio` | 25,192 | `sales-companion-architecture-pass4.png` | `sales-companion-components-pass4.png` |

Pass 1 is an **800.6% increase** over the deliberately minimal pitch source. Later passes remove redundant relationships and improve semantics, so raw XML size is not expected to increase monotonically.

## Review passes

1. **Meaningful expansion:** separated M365/Cowork host, Entra token issuer, Easy Auth enforcement, Function application, UI resource, tools, data providers, state, and telemetry. Added a separate code-level component page and explicit PoC safety boundaries.
2. **Readability and contrast:** standardized accessible blue/teal/brown connectors, A5 spacing, legends, telemetry guidance, and simplified labels.
3. **Semantic correction:** added the identity-isolation production gate, distinguished user identity from managed identity, qualified the optional upstream MCP path, and showed Application Insights linked to Log Analytics.
4. **Publication polish:** removed crossed/ambiguous dependency arrows, rerouted the host-mediated UI return, kept labels inside boxes, added invariants, and verified both final PNGs at full-page and enlarged views.

`sales-companion-architecture.drawio` and the two unnumbered PNGs are copies of Pass 4. The prior byte-identical pass artifacts were replaced; every saved pass now has a distinct editable source and matching export.
