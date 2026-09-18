import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { DataMode, Opportunity, OpportunitySummary, SalesDashboard } from "./salesTypes";

const summarySchema = z.object({
  id: z.string().min(1),
  accountName: z.string().min(1),
  name: z.string().min(1),
  stage: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  closeDate: z.string().min(1),
  probabilityBps: z.number().int().min(0).max(10000),
});

const dashboardSeedSchema = z.object({
  currency: z.literal("USD").default("USD"),
  opportunities: z.array(summarySchema).min(1),
});

const opportunitySeedSchema = summarySchema.extend({
  ownerName: z.string().min(1),
  nextStep: z.string().min(1),
  notes: z.string(),
  quoteCatalog: z.tuple([
    z.object({
      sku: z.string().min(1),
      description: z.string().min(1),
      unitPriceCents: z.number().int().positive(),
    }),
    z.object({
      sku: z.string().min(1),
      description: z.string().min(1),
      unitPriceCents: z.number().int().positive(),
    }),
  ]),
});

const SYNTHETIC_OPPORTUNITIES: Opportunity[] = [
  {
    id: "opp-northwind-renewal",
    accountName: "Northwind Traders",
    name: "Commerce cloud renewal",
    stage: "Proposal",
    amountCents: 14800000,
    closeDate: "2026-10-15",
    probabilityBps: 7200,
    ownerName: "Avery Morgan",
    nextStep: "Review the simulated quote with the buying committee.",
    notes: "Deterministic PoC record. No CRM system is read or updated.",
    quoteCatalog: [
      { sku: "CLOUD-SEAT", description: "Commerce cloud seat", unitPriceCents: 12500 },
      { sku: "ONBOARD", description: "Onboarding service", unitPriceCents: 8000 },
    ],
    provenance: "Synthetic demo data",
    simulationNotice: "Simulation - not CRM",
  },
  {
    id: "opp-contoso-expansion",
    accountName: "Contoso Ltd",
    name: "Sales analytics expansion",
    stage: "Discovery",
    amountCents: 9200000,
    closeDate: "2026-11-20",
    probabilityBps: 4500,
    ownerName: "Jordan Lee",
    nextStep: "Confirm user count and implementation scope.",
    notes: "Deterministic PoC record. No CRM system is read or updated.",
    quoteCatalog: [
      { sku: "ANALYTICS", description: "Analytics user license", unitPriceCents: 9900 },
      { sku: "ENABLE", description: "Enablement workshop", unitPriceCents: 150000 },
    ],
    provenance: "Synthetic demo data",
    simulationNotice: "Simulation - not CRM",
  },
  {
    id: "opp-fabrikam-pilot",
    accountName: "Fabrikam",
    name: "Field sales pilot",
    stage: "Qualification",
    amountCents: 4800000,
    closeDate: "2026-12-05",
    probabilityBps: 3000,
    ownerName: "Taylor Kim",
    nextStep: "Validate pilot success criteria.",
    notes: "Deterministic PoC record. No CRM system is read or updated.",
    quoteCatalog: [
      { sku: "FIELD-USER", description: "Field sales user", unitPriceCents: 7500 },
      { sku: "PILOT", description: "Pilot setup", unitPriceCents: 95000 },
    ],
    provenance: "Synthetic demo data",
    simulationNotice: "Simulation - not CRM",
  },
];

export function normalizeDashboardSeed(seed: unknown, provenance: string): SalesDashboard {
  const parsed = dashboardSeedSchema.parse(seed) as {
    currency: "USD";
    opportunities: OpportunitySummary[];
  };
  const opportunities = [...parsed.opportunities].sort((a, b) => a.id.localeCompare(b.id));
  return {
    generatedAt: "2026-09-18T00:00:00.000Z",
    currency: "USD",
    pipelineCents: opportunities.reduce((sum, item) => sum + item.amountCents, 0),
    weightedPipelineCents: opportunities.reduce(
      (sum, item) => sum + Math.round((item.amountCents * item.probabilityBps) / 10000),
      0
    ),
    opportunities,
    provenance,
    simulationNotice: "Simulation - not CRM",
  };
}

function normalizeOpportunitySeed(seed: unknown, provenance: string): Opportunity {
  const parsed = opportunitySeedSchema.parse(seed) as Omit<Opportunity, "provenance" | "simulationNotice">;
  return {
    ...parsed,
    provenance,
    simulationNotice: "Simulation - not CRM",
  };
}

function parseRemoteResult(result: Awaited<ReturnType<Client["callTool"]>>): unknown {
  if (result.isError) {
    const content = result.content as Array<{ type: string; text?: string }>;
    const message = content
      .filter((item) => item.type === "text")
      .map((item) => item.text || "")
      .join(" ");
    throw new Error(`CRM MCP tool failed: ${message || "unknown upstream error"}`);
  }
  if (result.structuredContent) {
    return result.structuredContent;
  }
  const text = (result.content as Array<{ type: string; text?: string }>).find((item) => item.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("CRM MCP tool returned neither structuredContent nor JSON text.");
  }
  try {
    return JSON.parse(text.text || "");
  } catch {
    throw new Error("CRM MCP tool returned invalid JSON text.");
  }
}

async function callCrmTool(
  name: "get_sales_dashboard" | "get_opportunity",
  args: Record<string, unknown>
): Promise<unknown> {
  const uri = process.env.CRM_MCP_URI?.trim();
  if (!uri) {
    throw new Error("DATA_MODE=mcp requires server-side CRM_MCP_URI.");
  }

  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new Error("CRM_MCP_URI must be a valid absolute URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("CRM_MCP_URI must use http or https.");
  }

  const client = new Client({ name: "sales-companion-crm-reader", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(url);
  try {
    await client.connect(transport);
    const result = await client.callTool({ name, arguments: args });
    return parseRemoteResult(result);
  } finally {
    await client.close().catch(() => undefined);
  }
}

export function getDataMode(): DataMode {
  const value = (process.env.DATA_MODE || "synthetic").toLowerCase();
  if (value !== "synthetic" && value !== "mcp") {
    throw new Error("DATA_MODE must be synthetic or mcp.");
  }
  return value;
}

export async function getSalesDashboardData(): Promise<SalesDashboard> {
  if (getDataMode() === "synthetic") {
    return normalizeDashboardSeed(
      { currency: "USD", opportunities: SYNTHETIC_OPPORTUNITIES.map(toSummary) },
      "Synthetic demo data"
    );
  }
  const result = await callCrmTool("get_sales_dashboard", {});
  return normalizeDashboardSeed(result, "CRM MCP read-only source");
}

export async function getOpportunityData(opportunityId: string): Promise<Opportunity> {
  if (!opportunityId?.trim()) {
    throw new Error("opportunityId is required.");
  }
  if (getDataMode() === "synthetic") {
    const opportunity = SYNTHETIC_OPPORTUNITIES.find((item) => item.id === opportunityId);
    if (!opportunity) {
      throw new Error(`Opportunity not found: ${opportunityId}`);
    }
    return { ...opportunity, quoteCatalog: opportunity.quoteCatalog.map((item) => ({ ...item })) as Opportunity["quoteCatalog"] };
  }
  const result = await callCrmTool("get_opportunity", { opportunityId });
  return normalizeOpportunitySeed(result, "CRM MCP read-only source");
}

function toSummary(opportunity: Opportunity): OpportunitySummary {
  const { id, accountName, name, stage, amountCents, closeDate, probabilityBps } = opportunity;
  return { id, accountName, name, stage, amountCents, closeDate, probabilityBps };
}
