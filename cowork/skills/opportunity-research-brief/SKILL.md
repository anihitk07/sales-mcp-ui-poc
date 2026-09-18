---
name: opportunity-research-brief
description: |
  Builds a meeting-ready Word opportunity brief and optional email draft from
  the Sales Companion MCP server. Use when the user asks to brief an opportunity,
  prepare for a customer call, research an account, explain a deal, identify
  quote inputs, or draft a pre-meeting briefing.
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
5. Show the proposed one-page structure and grounded facts before creating artifacts.
6. Use Cowork's built-in Word capability to create the brief using `references/brief-template.md`.
7. If requested, use Cowork's built-in email capability to draft—but not send—a short pre-meeting note linking the brief. Do not invent recipients.

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
