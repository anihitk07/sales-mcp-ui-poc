---
name: pipeline-review-pack
description: |
  Reviews the Sales Companion pipeline and produces a defensible, filter-aware
  summary. Use when the user asks to review pipeline, forecast coverage, filter
  opportunities, compare stages, prepare a forecast call, or explain pipeline risk.
---

# Pipeline Review Pack

Use this skill for a read-only Cowork analysis of the current sales dashboard. It is a review workflow, not a CRM update workflow.

## Inputs

- Scope or search phrase (optional; default is all returned opportunities).
- Stage, minimum amount, and sort preference (optional).
- Audience: rep, manager, or executive (optional; default is internal review).

## Workflow

1. Call `get_sales_dashboard` once and retain the validated payload as the source of truth.
2. Apply requested stage, text, amount, and sort filters to the returned opportunities. Do not invent records or silently fetch a different dataset.
3. Reconcile pipeline total, weighted pipeline, stage mix, and visible deal count from the same filtered set.
4. Call `get_opportunity` only for the one to three deals needed to explain a risk, concentration, or next action.
5. Present a concise review with assumptions, provenance, and a table of visible deals. Offer Cowork's built-in Excel/PowerPoint skills only as a separate user-requested artifact step.

## Output

- Scope and filters used.
- Pipeline total, weighted total, stage mix, and visible count.
- Top opportunities by amount and close date.
- Risks or missing data, explicitly marked as unknown when absent.
- Recommended next actions grounded in returned fields.

## Guardrails

- Label every result `Synthetic demo data` when the payload says so.
- Never claim forecast certainty, CRM freshness, or a production write.
- Never call `preview_quote` or `save_demo_quote` from this skill.
- Do not send email or create files without a separate explicit request and confirmation.
