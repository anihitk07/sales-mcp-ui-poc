---
name: pipeline-review-pack
description: |
  Builds a grounded Sales Companion pipeline review pack: reconciled analysis,
  an Excel workbook, a PowerPoint narrative, and an executive email draft. Use
  when the user asks to review pipeline, prepare a forecast call, create a QBR
  pack, compare stages, build a board update, or explain pipeline risk.
---

# Pipeline Review Pack

Use this skill as a sales-manager workflow. Read the current dashboard once, derive every number from that payload, then use Cowork's built-in Excel, PowerPoint, and email-drafting capabilities to create a consistent review pack. It is not a CRM update or email-send workflow.

## Inputs

- Scope or search phrase (optional; default is all returned opportunities).
- Stage, minimum amount, and sort preference (optional).
- Audience: rep, manager, or executive (optional; default is internal review).

## Workflow

1. Call `get_sales_dashboard` once and retain the validated payload as the source of truth.
2. Apply requested stage, text, amount, and sort filters to the returned opportunities. Do not invent records or silently fetch a different dataset.
3. Reconcile pipeline total, weighted pipeline, stage mix, and visible deal count from the same filtered set.
4. Call `get_opportunity` only for the one to three deals needed to explain a risk, concentration, or next action.
5. Show the reconciled headline and proposed artifact outline before generating files.
6. Use Cowork's built-in Excel capability to create a summary sheet, opportunity-detail sheet, and stage-mix chart from the same derived dataset.
7. Use Cowork's built-in PowerPoint capability to create a concise forecast narrative: headline, stage mix, largest deals, risks/unknowns, and asks.
8. Draft—but do not send—an executive email containing the same headline numbers and links to the workbook/deck.
9. Reconcile the figures across chat, workbook, deck, and email draft before reporting completion.

## Output

- Scope, filters, provenance, pipeline total, weighted total, stage mix, and visible count.
- `pipeline-review.xlsx`: summary, opportunity detail, and stage-mix sheets.
- `pipeline-review.pptx`: executive narrative using the reconciled figures.
- Executive email draft: headline, top risks, and explicit asks; never automatically sent.
- Risks, unknowns, and recommended next actions grounded in returned fields.

## Guardrails

- Label every result `Synthetic demo data` when the payload says so.
- Never claim forecast certainty, CRM freshness, or a production write.
- Never call `preview_quote` or `save_demo_quote` from this skill.
- Do not send email or create files without a separate explicit request and confirmation.
