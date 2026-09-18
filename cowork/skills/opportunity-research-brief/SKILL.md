---
name: opportunity-research-brief
description: |
  Builds a meeting-ready opportunity brief from the Sales Companion MCP server.
  Use when the user asks to brief an opportunity, prepare for a customer call,
  research an account, explain a deal, or identify quote inputs.
---

# Opportunity Research Brief

Create a compact, source-grounded brief using read-only sales data.

## Inputs

- Opportunity or account name/ID.
- Meeting purpose and date, if relevant.
- Specific concern such as stage, amount, close date, or quote preparation.

## Workflow

1. Call `get_sales_dashboard` to resolve a name to a stable opportunity ID when needed.
2. Call `get_opportunity` for the selected ID.
3. Summarize account, opportunity, stage, amount, probability, close date, products, and next-step fields returned by the server.
4. Mark missing fields as `unknown — confirm in meeting`; do not infer contacts, activity, legal status, or customer commitments that this MCP does not return.
5. If the user asks for a Word brief, hand the grounded summary to Cowork's built-in Word skill after showing the outline for approval.

## Output

- Opportunity snapshot.
- Commercials and eligible quote items.
- Key risks and unknowns.
- Suggested questions and next step, clearly separated from facts.
- Provenance label and stable opportunity ID.

## Guardrails

- Read-only: do not call quote preview or save.
- Never fabricate account contacts, activity, compliance, or Salesforce status.
- Synthetic data must be labeled and must not be presented as customer data.
- Do not email or schedule anything without explicit user confirmation.
