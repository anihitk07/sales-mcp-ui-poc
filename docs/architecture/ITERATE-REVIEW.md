# Draw.io Iterate review record

The diagrams were developed as a pitch plus four review passes on a two-page
A5-landscape source (`1120 × 790`), exported with diagrams.net desktop v31.4.5.

**Retention:** at the maintainer's explicit request, only the final artifact is
kept. The intermediate pitch and per-pass `.drawio`/`.png` files were deleted, so
this repository no longer carries per-pass evidence — the measured growth and
defect records below are a summary, not a reproducible audit trail.

## Review passes

1. **Meaningful expansion:** separated M365/Cowork host, Entra token issuer, Easy
   Auth enforcement, Function application, UI resource, tools, data providers,
   state, and telemetry. Added a code-level component page and explicit PoC
   safety boundaries. Non-whitespace XML grew from 2,860 to 25,758 characters
   (an 800.6% increase over the deliberately minimal pitch).
2. **Readability and contrast:** standardized accessible blue/teal/brown
   connectors, A5 spacing, legends, telemetry guidance, and simplified labels.
3. **Semantic correction:** added the identity-isolation production gate,
   distinguished user identity from managed identity, qualified the optional
   upstream MCP path, and linked Application Insights to Log Analytics.
4. **Publication polish:** removed crossed and ambiguous dependency arrows,
   rerouted the host-mediated UI return, kept labels inside boxes, and added the
   invariants band.

## Final rebuild

After pass 4 the source was rebuilt so that every real Azure service is drawn
with its official Azure architecture icon instead of a generic labelled box.
Both pages were re-exported and inspected: the deployment page was corrected for
canvas overflow, label collisions on the Entra and right-hand service column, and
an adapter edge that appeared to run through the node it terminated on.

## Component-architecture refinement (2026-09-19)

The component page was independently re-pitched as a responsibility map while
the approved Azure deployment page and PNG remained unchanged.

- **Pitch:** reduced the story to host mediation → application responsibilities
  → Azure/data dependencies (1,082 non-whitespace XML characters).
- **Pass 1 — visual upgrade:** expanded to 16,955 characters (**1,467% growth**),
  adding separate request/result paths, five-tool registration, read and
  state-changing handlers, `salesData`, embedded synthetic data, `quoteService`,
  `quoteMath`, `quoteStore`, identity scope, optional CRM MCP, Blob storage,
  telemetry, legend, production gate, and invariants.
- **Pass 2:** moved relationship labels into routing gutters and routed the
  optional MCP edge around embedded data.
- **Pass 3:** added the missing registration-to-handler dispatch relationships.
- **Passes 4–7:** repeatedly corrected those dispatch routes until they no
  longer crossed components or labels.
- **Pass 8:** shortened the supporting-services heading to remove a subtle
  right-edge overflow that caused diagrams.net to export a blank second page.

Every PNG was inspected after export. The final page is `1122 × 792` pixels and
shows no overlapping nodes/labels or connectors crossing unrelated components.
At the maintainer's request, intermediate files are not committed; only the
final editable two-page source and matching PNG remain in the repository.
