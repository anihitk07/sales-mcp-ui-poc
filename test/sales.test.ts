import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { trigger } from "@azure/functions";
import { calculateQuote, validateQuoteInput } from "../src/functions/quoteMath";
import { getSalesDashboardData, normalizeDashboardSeed } from "../src/functions/salesData";
import { DocumentStore, StoredDocument } from "../src/functions/quoteStore";
import { previewQuote, saveDemoQuote } from "../src/functions/quoteService";
import { IdentityScope, Opportunity } from "../src/functions/salesTypes";

class MemoryTestStore implements DocumentStore {
  private documents = new Map<string, StoredDocument<unknown>>();
  private version = 0;

  async get<T>(documentPath: string): Promise<StoredDocument<T> | null> {
    const item = this.documents.get(documentPath);
    return item ? { value: structuredClone(item.value) as T, etag: item.etag } : null;
  }

  async create<T>(documentPath: string, value: T): Promise<void> {
    if (this.documents.has(documentPath)) {
      throw Object.assign(new Error("already exists"), { statusCode: 409 });
    }
    this.documents.set(documentPath, { value: structuredClone(value), etag: this.nextEtag() });
  }

  async replace<T>(documentPath: string, value: T, etag: string): Promise<void> {
    const item = this.documents.get(documentPath);
    if (!item || item.etag !== etag) {
      throw Object.assign(new Error("etag conflict"), { statusCode: 412 });
    }
    this.documents.set(documentPath, { value: structuredClone(value), etag: this.nextEtag() });
  }

  private nextEtag(): string {
    this.version += 1;
    return `"${this.version}"`;
  }
}

const opportunity: Opportunity = {
  id: "opp-test",
  accountName: "Test Account",
  name: "Test Opportunity",
  stage: "Proposal",
  amountCents: 33000,
  closeDate: "2026-10-01",
  probabilityBps: 5000,
  ownerName: "Test Owner",
  nextStep: "Test",
  notes: "Test",
  quoteCatalog: [
    { sku: "PRODUCT", description: "Product", unitPriceCents: 12500 },
    { sku: "SERVICE", description: "Service", unitPriceCents: 8000 },
  ],
  provenance: "Synthetic demo data",
  simulationNotice: "Simulation - not CRM",
};

const identity: IdentityScope = {
  key: "test:user",
  label: "Test identity",
  proven: true,
};

test("quote arithmetic uses integer cents and basis points", () => {
  const quote = calculateQuote(opportunity, {
    productQuantity: 2,
    serviceQuantity: 1,
    discountBps: 1000,
  });
  assert.equal(quote.totals.subtotalCents, 33000);
  assert.equal(quote.totals.discountCents, 3300);
  assert.equal(quote.totals.totalCents, 29700);
});

test("quote validation enforces quantity and discount bounds", () => {
  assert.throws(
    () => validateQuoteInput({ productQuantity: -1, serviceQuantity: 1, discountBps: 0 }),
    /productQuantity/
  );
  assert.throws(
    () => validateQuoteInput({ productQuantity: 1, serviceQuantity: 101, discountBps: 0 }),
    /serviceQuantity/
  );
  assert.throws(
    () => validateQuoteInput({ productQuantity: 1, serviceQuantity: 0, discountBps: 5001 }),
    /discountBps/
  );
  assert.throws(
    () => validateQuoteInput({ productQuantity: 0, serviceQuantity: 0, discountBps: 0 }),
    /At least one/
  );
});

test("dashboard seed normalization is stable and computes totals", () => {
  const dashboard = normalizeDashboardSeed({
    opportunities: [
      {
        id: "b",
        accountName: "B",
        name: "B deal",
        stage: "Discovery",
        amountCents: 10000,
        closeDate: "2026-11-01",
        probabilityBps: 2500,
      },
      {
        id: "a",
        accountName: "A",
        name: "A deal",
        stage: "Proposal",
        amountCents: 20000,
        closeDate: "2026-10-01",
        probabilityBps: 5000,
      },
    ],
  }, "Fixture MCP");
  assert.deepEqual(dashboard.opportunities.map((item) => item.id), ["a", "b"]);
  assert.equal(dashboard.pipelineCents, 30000);
  assert.equal(dashboard.weightedPipelineCents, 12500);
  assert.equal(dashboard.provenance, "Fixture MCP");
});

test("mcp data mode fails explicitly without a configured server URI", async () => {
  const previousMode = process.env.DATA_MODE;
  const previousUri = process.env.CRM_MCP_URI;
  process.env.DATA_MODE = "mcp";
  delete process.env.CRM_MCP_URI;
  await assert.rejects(getSalesDashboardData(), /requires server-side CRM_MCP_URI/);
  if (previousMode === undefined) delete process.env.DATA_MODE;
  else process.env.DATA_MODE = previousMode;
  if (previousUri === undefined) delete process.env.CRM_MCP_URI;
  else process.env.CRM_MCP_URI = previousUri;
});

test("preview revisions and simulated save are confirmed and idempotent", async () => {
  process.env.DATA_MODE = "synthetic";
  const store = new MemoryTestStore();
  const first = await previewQuote(store, identity, {
    opportunityId: "opp-northwind-renewal",
    productQuantity: 2,
    serviceQuantity: 1,
    discountBps: 1000,
  });
  assert.equal(first.revision, 1);
  assert.equal(first.totals.totalCents, 29700);

  await assert.rejects(
    previewQuote(store, identity, {
      opportunityId: first.opportunityId,
      productQuantity: 3,
      serviceQuantity: 1,
      discountBps: 1000,
      draftId: first.draftId,
      revision: 0,
    }),
    /revision conflict/
  );

  const second = await previewQuote(store, identity, {
    opportunityId: first.opportunityId,
    productQuantity: 3,
    serviceQuantity: 1,
    discountBps: 1000,
    draftId: first.draftId,
    revision: first.revision,
  });
  assert.equal(second.revision, 2);

  await assert.rejects(
    saveDemoQuote(store, identity, {
      draftId: second.draftId,
      revision: second.revision,
      confirm: false,
      idempotencyKey: "save-1",
    }),
    /Explicit confirmation/
  );

  const saved = await saveDemoQuote(store, identity, {
    draftId: second.draftId,
    revision: second.revision,
    confirm: true,
    idempotencyKey: "save-1",
  });
  assert.equal(saved.idempotent, false);
  assert.equal(saved.quote.status, "SIMULATED_SAVED");

  const replay = await saveDemoQuote(store, identity, {
    draftId: second.draftId,
    revision: second.revision,
    confirm: true,
    idempotencyKey: "save-1",
  });
  assert.equal(replay.idempotent, true);
  assert.equal(replay.quote.quoteId, saved.quote.quoteId);

  await assert.rejects(
    saveDemoQuote(store, identity, {
      draftId: second.draftId,
      revision: second.revision,
      confirm: true,
      idempotencyKey: "different-key",
    }),
    /different idempotency key/
  );
});

test("MCP Apps resource metadata and bundled HTML are present", () => {
  const root = path.resolve(__dirname, "..", "..");
  const serverSource = fs.readFileSync(path.join(root, "src", "functions", "salesMcpApp.ts"), "utf8");
  const bundledHtml = fs.readFileSync(path.join(root, "src", "app", "dist", "index.html"), "utf8");
  const uiSource = fs.readFileSync(path.join(root, "src", "app", "src", "sales-app.ts"), "utf8");

  assert.match(serverSource, /ui:\/\/sales\/workspace\.html/);
  assert.match(serverSource, /text\/html;profile=mcp-app/);
  assert.match(serverSource, /readOnlyHint/);
  assert.match(bundledHtml, /Sales companion/);
  assert.match(bundledHtml, /Simulation - not CRM/);
  assert.match(bundledHtml, /callServerTool/);
  assert.match(bundledHtml, /Pipeline by opportunity/);
  assert.match(bundledHtml, /Pipeline mix by stage/);
  assert.match(bundledHtml, /filter-stage/);
  assert.match(bundledHtml, /filter-sort/);
  assert.match(uiSource, /renderPipelineBars/);
  assert.match(uiSource, /renderStageDonut/);
  assert.match(uiSource, /filterOpportunities/);
  assert.match(uiSource, /createElementNS/);
  assert.match(uiSource, /CONFIRM_SIMULATED_SAVE/);
  assert.match(uiSource, /timed out\. Retry the action/);
  assert.doesNotMatch(uiSource, /\.innerHTML/);
});

test("Azure Functions accepts the shared no-argument MCP registration shape", () => {
  const { withRequiredToolProperties, validateSaveConfirmation, SAVE_CONFIRMATION_TOKEN } = require("../src/functions/salesMcpApp") as {
    withRequiredToolProperties: (
      options: Parameters<typeof trigger.mcpTool>[0]
    ) => Parameters<typeof trigger.mcpTool>[0];
    validateSaveConfirmation: (value: unknown) => true;
    SAVE_CONFIRMATION_TOKEN: string;
  };
  const options = withRequiredToolProperties({
    toolName: "no_argument_tool",
    description: "Regression check for Functions MCP indexing.",
    handler: async () => undefined,
  });

  assert.deepEqual(options.toolProperties, []);
  assert.doesNotThrow(() => trigger.mcpTool(options));
  assert.equal(validateSaveConfirmation(SAVE_CONFIRMATION_TOKEN), true);
  assert.throws(() => validateSaveConfirmation(true), /confirmationToken/);
  assert.throws(() => validateSaveConfirmation(undefined), /confirmationToken/);
});

test("pinned M365 package exposes only PoC tools and no CRM write tools", () => {
  const root = path.resolve(__dirname, "..", "..");
  const plugin = JSON.parse(
    fs.readFileSync(path.join(root, "appPackage", "ai-plugin.json"), "utf8")
  ) as { functions: Array<{ name: string }>; runtimes: Array<{ run_for_functions: string[] }> };
  const names = plugin.functions.map((item) => item.name);
  assert.deepEqual(names, [
    "get_sales_dashboard",
    "get_opportunity",
    "preview_quote",
    "save_demo_quote",
    "get_demo_quote",
  ]);
  assert.deepEqual(plugin.runtimes[0].run_for_functions, names);
  assert.equal(names.some((name) => /create|update|delete|crm_write/i.test(name)), false);

  const tools = JSON.parse(
    fs.readFileSync(path.join(root, "appPackage", "mcp-tools.json"), "utf8")
  ) as { tools: Array<{ name: string; inputSchema: { properties: Record<string, unknown>; required: string[] } }> };
  const saveTool = tools.tools.find((tool) => tool.name === "save_demo_quote");
  assert.ok(saveTool);
  assert.deepEqual(saveTool.inputSchema.properties.confirmationToken, {
    type: "string",
    const: "CONFIRM_SIMULATED_SAVE",
  });
  assert.equal("confirm" in saveTool.inputSchema.properties, false);
  assert.ok(saveTool.inputSchema.required.includes("confirmationToken"));
});

test("pinned MCP tool descriptions bind every tool to the MCP Apps UI resource", () => {
  const root = path.resolve(__dirname, "..", "..");
  const pinned = JSON.parse(
    fs.readFileSync(path.join(root, "appPackage", "mcp-tools.json"), "utf8")
  ) as { tools: Array<{ name: string; _meta?: { ui?: { resourceUri?: string; visibility?: string[] } } }> };

  assert.equal(pinned.tools.length, 5);
  for (const tool of pinned.tools) {
    assert.equal(
      tool._meta?.ui?.resourceUri,
      "ui://sales/workspace.html",
      `${tool.name} must declare the MCP Apps UI resource so the host renders the widget.`
    );
    assert.ok(
      tool._meta?.ui?.visibility?.includes("model"),
      `${tool.name} must remain model-visible.`
    );
  }
});
