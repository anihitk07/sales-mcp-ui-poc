export type DataMode = "synthetic" | "mcp";

export interface OpportunitySummary {
  id: string;
  accountName: string;
  name: string;
  stage: string;
  amountCents: number;
  closeDate: string;
  probabilityBps: number;
}

export interface SalesDashboard {
  generatedAt: string;
  currency: "USD";
  pipelineCents: number;
  weightedPipelineCents: number;
  opportunities: OpportunitySummary[];
  provenance: string;
  simulationNotice: "Simulation - not CRM";
}

export interface QuoteCatalogItem {
  sku: string;
  description: string;
  unitPriceCents: number;
}

export interface Opportunity extends OpportunitySummary {
  ownerName: string;
  nextStep: string;
  notes: string;
  quoteCatalog: [QuoteCatalogItem, QuoteCatalogItem];
  provenance: string;
  simulationNotice: "Simulation - not CRM";
}

export interface QuoteLine {
  sku: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface QuoteTotals {
  subtotalCents: number;
  discountBps: number;
  discountCents: number;
  totalCents: number;
}

export interface QuoteDraft {
  draftId: string;
  revision: number;
  opportunityId: string;
  currency: "USD";
  lines: QuoteLine[];
  totals: QuoteTotals;
  identityLabel: string;
  identityProven: boolean;
  updatedAt: string;
  provenance: string;
  simulationNotice: "Simulation - not CRM";
}

export interface SavedDemoQuote extends QuoteDraft {
  quoteId: string;
  savedAt: string;
  idempotencyKey: string;
  status: "SIMULATED_SAVED";
}

export interface IdentityScope {
  key: string;
  label: string;
  proven: boolean;
}
