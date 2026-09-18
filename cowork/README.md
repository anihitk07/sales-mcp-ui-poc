# Sales Companion for Copilot Cowork

This package adds Cowork-compatible Agent Skills on top of the deployed Sales Companion MCP server. It follows the L2Q pattern: lean `SKILL.md` workflows orchestrate connector tools and leave document/email/calendar creation to Cowork's built-in skills.

## Included skills

| Skill | Purpose | MCP tools | Writes |
|---|---|---|---|
| `pipeline-review-pack` | Review, filter, and explain the current pipeline | `get_sales_dashboard`, `get_opportunity` | None |
| `opportunity-research-brief` | Prepare an opportunity/account brief and surface quote inputs | `get_sales_dashboard`, `get_opportunity` | None |
| `simulated-quote-review` | Build, revise, and explicitly confirm a simulated quote | `get_opportunity`, `preview_quote`, `save_demo_quote`, `get_demo_quote` | Blob-backed simulation only |

All outputs must label synthetic data and simulated saves. No skill can write to CRM, send email, schedule meetings, or claim a production quote was saved.

## Setup

1. Replace `REPLACE_WITH_MCP_URI` in `manifest.json` with the approved MCP endpoint, or use the server-side endpoint configured by the host.
2. If the endpoint is protected, configure the host's supported MCP authentication; do not put credentials in this folder.
3. Package the folder with `scripts/package.ps1` and upload it through the approved Cowork custom-app flow.
4. Open Cowork's Sources & Skills view and verify the three skills are listed.

The skills are portable Agent Skills documents and can also be inspected by other compatible agent runtimes. Cowork's built-in Word, Excel, PowerPoint, email, and calendar capabilities are intentionally not duplicated.

## Safety model

- Reads are read-only and should not ask for repeated confirmation after initial connector consent.
- Quote preview creates only a user-scoped demo draft.
- `save_demo_quote` is side-effecting and requires the exact `CONFIRM_SIMULATED_SAVE` token, current revision, and idempotency key.
- Review the draft before any simulated save. Never weaken the token or describe simulation storage as CRM persistence.

## Reference

The package is inspired by the structure and workflow style of [L2Q Cowork](https://github.com/scadam/L2Q/tree/main/cowork), but contains original sales workflows and no copied L2Q source or assets. The MCP contract is defined by this repository's `appPackage/mcp-tools.json`.
