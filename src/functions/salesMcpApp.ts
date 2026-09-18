import {
  app,
  arg,
  InvocationContext,
  McpTextContent,
  McpToolResponse,
} from "@azure/functions";
import * as fs from "fs";
import * as path from "path";
import { getOpportunityData, getSalesDashboardData } from "./salesData";
import { resolveIdentity } from "./identity";
import { BlobDocumentStore } from "./quoteStore";
import { getDemoQuote, previewQuote, saveDemoQuote } from "./quoteService";

export const SALES_UI_URI = "ui://sales/workspace.html";
export const SALES_UI_MIME_TYPE = "text/html;profile=mcp-app";
export const SAVE_CONFIRMATION_TOKEN = "CONFIRM_SIMULATED_SAVE";

const UI_METADATA = JSON.stringify({
  ui: { resourceUri: SALES_UI_URI },
});
const RESOURCE_METADATA = JSON.stringify({
  ui: { prefersBorder: true },
});
const READ_ONLY_METADATA = JSON.stringify({
  ui: { resourceUri: SALES_UI_URI },
  annotations: { readOnlyHint: true },
});
const WRITE_METADATA = JSON.stringify({
  ui: { resourceUri: SALES_UI_URI },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
});

const opportunitySummaryResultSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    accountName: { type: "string" },
    name: { type: "string" },
    stage: { type: "string" },
    amountCents: { type: "integer", minimum: 0 },
    closeDate: { type: "string" },
    probabilityBps: { type: "integer", minimum: 0, maximum: 10000 },
  },
  required: ["id", "accountName", "name", "stage", "amountCents", "closeDate", "probabilityBps"],
  additionalProperties: false,
};

const catalogItemResultSchema = {
  type: "object",
  properties: {
    sku: { type: "string" },
    description: { type: "string" },
    unitPriceCents: { type: "integer", minimum: 1 },
  },
  required: ["sku", "description", "unitPriceCents"],
  additionalProperties: false,
};

const quoteLineResultSchema = {
  type: "object",
  properties: {
    ...catalogItemResultSchema.properties,
    quantity: { type: "integer", minimum: 0 },
    lineTotalCents: { type: "integer", minimum: 0 },
  },
  required: [...catalogItemResultSchema.required, "quantity", "lineTotalCents"],
  additionalProperties: false,
};

const quoteTotalsResultSchema = {
  type: "object",
  properties: {
    subtotalCents: { type: "integer", minimum: 0 },
    discountBps: { type: "integer", minimum: 0, maximum: 5000 },
    discountCents: { type: "integer", minimum: 0 },
    totalCents: { type: "integer", minimum: 0 },
  },
  required: ["subtotalCents", "discountBps", "discountCents", "totalCents"],
  additionalProperties: false,
};

const draftResultProperties = {
  draftId: { type: "string" },
  revision: { type: "integer", minimum: 1 },
  opportunityId: { type: "string" },
  currency: { const: "USD" },
  lines: { type: "array", items: quoteLineResultSchema },
  totals: quoteTotalsResultSchema,
  identityLabel: { type: "string" },
  identityProven: { type: "boolean" },
  updatedAt: { type: "string" },
  provenance: { type: "string" },
  simulationNotice: { const: "Simulation - not CRM" },
};

const draftResultRequired = Object.keys(draftResultProperties);

const objectSchema = (properties: object, required: string[] = []) => JSON.stringify({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

export function withRequiredToolProperties(
  options: Parameters<typeof app.mcpTool>[1]
): Parameters<typeof app.mcpTool>[1] {
  return {
    ...options,
    toolProperties: options.toolProperties ?? [],
  };
}

function registerMcpTool(name: string, options: Parameters<typeof app.mcpTool>[1]): void {
  app.mcpTool(name, withRequiredToolProperties(options));
}

export function getSalesWorkspace(): string {
  const filePath = path.join(__dirname, "..", "..", "..", "src", "app", "dist", "index.html");
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`Sales workspace bundle not found. Run npm run build:app. ${String(error)}`);
  }
}

function args(context: InvocationContext): Record<string, unknown> {
  return (context.triggerMetadata.mcptoolargs as Record<string, unknown>) || {};
}

function integer(value: unknown, name: string, optional = false): number | undefined {
  if (optional && (value === undefined || value === null || value === "")) {
    return undefined;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer.`);
  }
  return parsed;
}

function text(value: unknown, name: string, optional = false): string | undefined {
  if (optional && (value === undefined || value === null || value === "")) {
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

export function validateSaveConfirmation(value: unknown): true {
  if (value !== SAVE_CONFIRMATION_TOKEN) {
    throw new Error(`confirmationToken must equal ${SAVE_CONFIRMATION_TOKEN}.`);
  }
  return true;
}

function success(summary: string, structuredContent: unknown): McpToolResponse {
  return new McpToolResponse({
    content: [new McpTextContent(summary)],
    structuredContent,
  });
}

function failure(context: InvocationContext, error: unknown): McpToolResponse {
  const message = error instanceof Error ? error.message : String(error);
  context.error(message);
  return new McpToolResponse({
    content: [new McpTextContent(message)],
    structuredContent: { ok: false, error: message },
    isError: true,
  });
}

async function handle(context: InvocationContext, work: () => Promise<McpToolResponse>): Promise<McpToolResponse> {
  try {
    return await work();
  } catch (error) {
    return failure(context, error);
  }
}

app.mcpResource("salesWorkspace", {
  uri: SALES_UI_URI,
  resourceName: "Sales companion workspace",
  description: "Bundled dashboard, opportunity, and simulated quote workspace.",
  mimeType: SALES_UI_MIME_TYPE,
  metadata: RESOURCE_METADATA,
  handler: async () => getSalesWorkspace(),
});

registerMcpTool("getSalesDashboard", {
  toolName: "get_sales_dashboard",
  description: "Returns the sales dashboard from synthetic data or the configured read-only CRM MCP server.",
  metadata: READ_ONLY_METADATA,
  resultSchema: objectSchema({
    generatedAt: { type: "string" },
    currency: { const: "USD" },
    pipelineCents: { type: "integer" },
    weightedPipelineCents: { type: "integer" },
    opportunities: { type: "array", items: opportunitySummaryResultSchema },
    provenance: { type: "string" },
    simulationNotice: { const: "Simulation - not CRM" },
  }, ["currency", "pipelineCents", "opportunities", "provenance", "simulationNotice"]),
  handler: async (_input, context) => handle(context, async () => {
    const dashboard = await getSalesDashboardData();
    return success(`Loaded ${dashboard.opportunities.length} sales opportunities. ${dashboard.simulationNotice}.`, dashboard);
  }),
});

registerMcpTool("getOpportunity", {
  toolName: "get_opportunity",
  description: "Returns one opportunity and its fixed PoC quote catalog.",
  toolProperties: {
    opportunityId: arg.string().describe("Stable opportunity ID from get_sales_dashboard."),
  },
  metadata: READ_ONLY_METADATA,
  resultSchema: objectSchema({
    id: { type: "string" },
    accountName: { type: "string" },
    name: { type: "string" },
    stage: { type: "string" },
    amountCents: { type: "integer", minimum: 0 },
    closeDate: { type: "string" },
    probabilityBps: { type: "integer", minimum: 0, maximum: 10000 },
    ownerName: { type: "string" },
    nextStep: { type: "string" },
    notes: { type: "string" },
    quoteCatalog: { type: "array", items: catalogItemResultSchema, minItems: 2, maxItems: 2 },
    provenance: { type: "string" },
    simulationNotice: { const: "Simulation - not CRM" },
  }, [
    "id", "accountName", "name", "stage", "amountCents", "closeDate", "probabilityBps",
    "ownerName", "nextStep", "notes", "quoteCatalog", "provenance", "simulationNotice"
  ]),
  handler: async (_input, context) => handle(context, async () => {
    const opportunity = await getOpportunityData(text(args(context).opportunityId, "opportunityId")!);
    return success(`Loaded ${opportunity.name} for ${opportunity.accountName}.`, opportunity);
  }),
});

registerMcpTool("previewQuote", {
  toolName: "preview_quote",
  description: "Creates or revises a server-side Blob-backed simulated quote draft using integer cents and basis points.",
  toolProperties: {
    opportunityId: arg.string().describe("Stable opportunity ID."),
    productQuantity: arg.number().describe("Whole-number quantity for the first catalog item."),
    serviceQuantity: arg.number().describe("Whole-number quantity for the second catalog item."),
    discountBps: arg.number().describe("Discount in basis points, from 0 through 5000."),
    draftId: arg.string().optional().describe("Existing draft ID when revising a preview."),
    revision: arg.number().optional().describe("Current server revision when revising a preview."),
  },
  metadata: UI_METADATA,
  resultSchema: objectSchema(draftResultProperties, draftResultRequired),
  handler: async (_input, context) => handle(context, async () => {
    const values = args(context);
    const draft = await previewQuote(new BlobDocumentStore(), resolveIdentity(context), {
      opportunityId: text(values.opportunityId, "opportunityId")!,
      productQuantity: integer(values.productQuantity, "productQuantity")!,
      serviceQuantity: integer(values.serviceQuantity, "serviceQuantity")!,
      discountBps: integer(values.discountBps, "discountBps")!,
      draftId: text(values.draftId, "draftId", true),
      revision: integer(values.revision, "revision", true),
    });
    return success(`Previewed simulated quote draft ${draft.draftId}, revision ${draft.revision}.`, draft);
  }),
});

registerMcpTool("saveDemoQuote", {
  toolName: "save_demo_quote",
  description: "Explicitly confirms and idempotently saves a simulated quote. This never writes to CRM.",
  toolProperties: {
    draftId: arg.string().describe("Server-issued quote draft ID."),
    revision: arg.number().describe("Exact server-issued draft revision."),
    confirmationToken: arg.string().describe(`Must equal ${SAVE_CONFIRMATION_TOKEN} to confirm this simulated save.`),
    idempotencyKey: arg.string().describe("Caller-generated stable key for safe retries."),
  },
  metadata: WRITE_METADATA,
  resultSchema: objectSchema({
    quote: {
      type: "object",
      properties: {
        ...draftResultProperties,
        quoteId: { type: "string" },
        savedAt: { type: "string" },
        idempotencyKey: { type: "string" },
        status: { const: "SIMULATED_SAVED" },
      },
      required: [...draftResultRequired, "quoteId", "savedAt", "idempotencyKey", "status"],
      additionalProperties: false,
    },
    idempotent: { type: "boolean" },
  }, ["quote", "idempotent"]),
  handler: async (_input, context) => handle(context, async () => {
    const values = args(context);
    const result = await saveDemoQuote(new BlobDocumentStore(), resolveIdentity(context), {
      draftId: text(values.draftId, "draftId")!,
      revision: integer(values.revision, "revision")!,
      confirm: validateSaveConfirmation(values.confirmationToken),
      idempotencyKey: text(values.idempotencyKey, "idempotencyKey")!,
    });
    return success(
      `${result.idempotent ? "Replayed" : "Saved"} SIMULATED quote ${result.quote.quoteId}. No CRM write occurred.`,
      result
    );
  }),
});

registerMcpTool("getDemoQuote", {
  toolName: "get_demo_quote",
  description: "Reads a previously saved simulated quote from identity-scoped Blob storage.",
  toolProperties: {
    quoteId: arg.string().describe("Saved simulated quote ID."),
  },
  metadata: READ_ONLY_METADATA,
  resultSchema: objectSchema({
    ...draftResultProperties,
    quoteId: { type: "string" },
    savedAt: { type: "string" },
    idempotencyKey: { type: "string" },
    status: { const: "SIMULATED_SAVED" },
  }, [...draftResultRequired, "quoteId", "savedAt", "idempotencyKey", "status"]),
  handler: async (_input, context) => handle(context, async () => {
    const quote = await getDemoQuote(
      new BlobDocumentStore(),
      resolveIdentity(context),
      text(args(context).quoteId, "quoteId")!
    );
    return success(`Loaded SIMULATED quote ${quote.quoteId}.`, quote);
  }),
});
