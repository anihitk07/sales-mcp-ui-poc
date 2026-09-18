import { randomUUID } from "crypto";
import { getOpportunityData } from "./salesData";
import { calculateQuote, QuoteInput } from "./quoteMath";
import { DocumentStore, identityPath, isStorageStatus } from "./quoteStore";
import { IdentityScope, QuoteDraft, SavedDemoQuote } from "./salesTypes";

export interface PreviewRequest extends QuoteInput {
  opportunityId: string;
  draftId?: string;
  revision?: number;
}

export interface SaveRequest {
  draftId: string;
  revision: number;
  confirm: boolean;
  idempotencyKey: string;
}

function draftPath(identity: IdentityScope, draftId: string): string {
  return identityPath(identity, `drafts/${draftId}.json`);
}

function quotePath(identity: IdentityScope, quoteId: string): string {
  return identityPath(identity, `quotes/${quoteId}.json`);
}

export async function previewQuote(
  store: DocumentStore,
  identity: IdentityScope,
  request: PreviewRequest
): Promise<QuoteDraft> {
  const opportunity = await getOpportunityData(request.opportunityId);
  const calculated = calculateQuote(opportunity, request);
  const now = new Date().toISOString();

  if (!request.draftId) {
    if (request.revision !== undefined) {
      throw new Error("revision must be omitted when creating a draft.");
    }
    const draft: QuoteDraft = {
      draftId: randomUUID(),
      revision: 1,
      opportunityId: opportunity.id,
      currency: "USD",
      ...calculated,
      identityLabel: identity.label,
      identityProven: identity.proven,
      updatedAt: now,
      provenance: opportunity.provenance,
      simulationNotice: "Simulation - not CRM",
    };
    await store.create(draftPath(identity, draft.draftId), draft);
    return draft;
  }

  if (!Number.isInteger(request.revision)) {
    throw new Error("revision is required when updating a draft.");
  }
  const path = draftPath(identity, request.draftId);
  const existing = await store.get<QuoteDraft>(path);
  if (!existing || !existing.etag) {
    throw new Error(`Draft not found: ${request.draftId}`);
  }
  if (existing.value.revision !== request.revision) {
    throw new Error(`Draft revision conflict. Current revision is ${existing.value.revision}.`);
  }
  if (existing.value.opportunityId !== opportunity.id) {
    throw new Error("A draft cannot be moved to another opportunity.");
  }
  const draft: QuoteDraft = {
    ...existing.value,
    ...calculated,
    revision: existing.value.revision + 1,
    updatedAt: now,
  };
  await store.replace(path, draft, existing.etag);
  return draft;
}

export async function saveDemoQuote(
  store: DocumentStore,
  identity: IdentityScope,
  request: SaveRequest
): Promise<{ quote: SavedDemoQuote; idempotent: boolean }> {
  if (request.confirm !== true) {
    throw new Error("Explicit confirmation is required: confirm must be true.");
  }
  if (!request.draftId?.trim() || !request.idempotencyKey?.trim()) {
    throw new Error("draftId and idempotencyKey are required.");
  }
  if (!Number.isInteger(request.revision) || request.revision < 1) {
    throw new Error("revision must be a positive integer.");
  }

  const draft = await store.get<QuoteDraft>(draftPath(identity, request.draftId));
  if (!draft) {
    throw new Error(`Draft not found: ${request.draftId}`);
  }
  if (draft.value.revision !== request.revision) {
    throw new Error(`Draft revision conflict. Current revision is ${draft.value.revision}.`);
  }

  const quoteId = `demo-${request.draftId}`;
  const quote: SavedDemoQuote = {
    ...draft.value,
    quoteId,
    savedAt: new Date().toISOString(),
    idempotencyKey: request.idempotencyKey,
    status: "SIMULATED_SAVED",
  };
  const path = quotePath(identity, quoteId);
  try {
    await store.create(path, quote);
    return { quote, idempotent: false };
  } catch (error) {
    if (!isStorageStatus(error, 409) && !isStorageStatus(error, 412)) {
      throw error;
    }
    const existing = await store.get<SavedDemoQuote>(path);
    if (!existing) {
      throw error;
    }
    if (
      existing.value.idempotencyKey !== request.idempotencyKey ||
      existing.value.revision !== request.revision
    ) {
      throw new Error("Quote already saved with a different idempotency key or revision.");
    }
    return { quote: existing.value, idempotent: true };
  }
}

export async function getDemoQuote(
  store: DocumentStore,
  identity: IdentityScope,
  quoteId: string
): Promise<SavedDemoQuote> {
  if (!quoteId?.trim()) {
    throw new Error("quoteId is required.");
  }
  const quote = await store.get<SavedDemoQuote>(quotePath(identity, quoteId));
  if (!quote) {
    throw new Error(`Simulated quote not found: ${quoteId}`);
  }
  return quote.value;
}
