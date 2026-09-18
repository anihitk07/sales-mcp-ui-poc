---
name: simulated-quote-review
description: |
  Prepares and reviews a simulated quote for a Sales Companion opportunity.
  Use when the user asks to price a deal, preview a quote, revise quantities or
  discount, save a demo quote, or reload a previously saved simulation.
---

# Simulated Quote Review

This workflow is deliberately limited to a Blob-backed simulation. It never writes to CRM.

## Inputs

- Stable opportunity ID or a name that can be resolved first.
- Product IDs, integer quantities, and discount percentage within the server's permitted range.
- For saving: explicit user approval and the exact confirmation token.

## Workflow

1. Resolve and inspect the opportunity with `get_opportunity`; do not accept product prices from the model or user as authoritative.
2. Call `preview_quote` with server-returned product IDs, quantities, and discount basis points.
3. Show the server-issued draft ID, revision, line items, subtotal, discount, total, and the labels `SIMULATED` and `Simulation - not saved to CRM`.
4. For edits, submit a new preview using the current draft revision. Treat stale-revision failures as a reason to reload, not to overwrite.
5. Before saving, show a final review and ask the user to explicitly approve the simulated save. Only after approval call `save_demo_quote` with:
   - `confirmationToken`: exactly `CONFIRM_SIMULATED_SAVE`
   - the current draft ID and revision
   - a fresh idempotency key
6. Report the returned simulated quote reference. If the user asks to reload, call `get_demo_quote` using the server-issued reference.
7. If requested, use Cowork's built-in Word capability to create a clearly watermarked `SIMULATED — not saved to CRM` quote-review document from the server-returned values. Do not create or send a customer-facing quote.

## Output

A review table with product, quantity, unit price, discount, subtotal, total, draft ID, revision, and provenance. After save, state exactly: `SIMULATED — not saved to CRM`.

## Guardrails

- Preview and cancel never count as a save.
- Never call save without explicit approval, the exact token, current revision, and idempotency key.
- Never change or weaken the token to bypass host confirmation.
- Do not retry a rejected save blindly; surface validation, ownership, or revision errors.
- Never send email, create a real quote, or claim CRM persistence.
