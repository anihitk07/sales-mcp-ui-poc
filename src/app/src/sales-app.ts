import { App } from "@modelcontextprotocol/ext-apps";

interface Dashboard {
  currency: "USD";
  pipelineCents: number;
  weightedPipelineCents: number;
  opportunities: OpportunitySummary[];
  provenance: string;
}

interface OpportunitySummary {
  id: string;
  accountName: string;
  name: string;
  stage: string;
  amountCents: number;
  closeDate: string;
  probabilityBps: number;
}

interface CatalogItem {
  sku: string;
  description: string;
  unitPriceCents: number;
}

interface Opportunity extends OpportunitySummary {
  ownerName: string;
  quoteCatalog: [CatalogItem, CatalogItem];
  provenance: string;
}

interface Draft {
  draftId: string;
  revision: number;
  opportunityId: string;
  lines: Array<CatalogItem & { quantity: number; lineTotalCents: number }>;
  totals: {
    subtotalCents: number;
    discountBps: number;
    discountCents: number;
    totalCents: number;
  };
  identityLabel: string;
  identityProven: boolean;
  provenance: string;
}

interface SavedResult {
  quote: Draft & { quoteId: string; status: "SIMULATED_SAVED" };
  idempotent: boolean;
}

const app = new App({ name: "Sales companion workspace", version: "1.0.0" });
const SAVE_CONFIRMATION_TOKEN = "CONFIRM_SIMULATED_SAVE";
const TOOL_TIMEOUT_MS = 20000;
const state: {
  dashboard?: Dashboard;
  opportunity?: Opportunity;
  draft?: Draft;
  quoteId?: string;
} = {};

function element<T extends Element = HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing UI element: ${id}`);
  return value as T;
}

function setText(id: string, value: string): void {
  element(id).textContent = value;
}

function money(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function setStatus(message: string, kind: "normal" | "error" | "success" = "normal"): void {
  const status = element("status");
  status.textContent = message;
  status.className = `status${kind === "error" ? " error" : kind === "success" ? " success" : ""}`;
}

function show(viewId: string, focusId: string): void {
  for (const id of ["dashboard-view", "opportunity-view", "quote-view", "saved-view"]) {
    element(id).classList.toggle("hidden", id !== viewId);
  }
  element<HTMLElement>(focusId).focus();
}

function clearChildren(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function cell(row: HTMLTableRowElement, value: string): void {
  const item = document.createElement("td");
  item.textContent = value;
  row.appendChild(item);
}

const chartColors = ["#2563eb", "#7c3aed", "#0f766e", "#c2410c", "#be123c", "#4b5563"];

function renderPipelineBars(opportunities: OpportunitySummary[]): void {
  const chart = element("pipeline-bars");
  clearChildren(chart);
  const maximum = Math.max(...opportunities.map((item) => item.amountCents), 1);
  for (const [index, opportunity] of opportunities.entries()) {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.setAttribute(
      "aria-label",
      `${opportunity.accountName}, ${money(opportunity.amountCents)}, ${opportunity.probabilityBps / 100}% probability`
    );

    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = opportunity.accountName;

    const track = document.createElement("span");
    track.className = "bar-track";
    const fill = document.createElement("span");
    fill.className = "bar-fill";
    fill.style.width = `${Math.max((opportunity.amountCents / maximum) * 100, 2)}%`;
    fill.style.backgroundColor = chartColors[index % chartColors.length];
    track.appendChild(fill);

    const value = document.createElement("span");
    value.className = "bar-value";
    value.textContent = money(opportunity.amountCents);
    row.append(label, track, value);
    chart.appendChild(row);
  }
}

function renderStageDonut(opportunities: OpportunitySummary[]): void {
  const svg = element<SVGSVGElement>("stage-donut");
  const legend = element("stage-legend");
  clearChildren(svg);
  clearChildren(legend);

  const totals = new Map<string, number>();
  for (const opportunity of opportunities) {
    totals.set(opportunity.stage, (totals.get(opportunity.stage) || 0) + opportunity.amountCents);
  }
  const total = [...totals.values()].reduce((sum, amount) => sum + amount, 0);
  const namespace = "http://www.w3.org/2000/svg";
  const title = document.createElementNS(namespace, "title");
  title.textContent = "Pipeline amount grouped by sales stage";
  svg.appendChild(title);

  const background = document.createElementNS(namespace, "circle");
  background.setAttribute("cx", "80");
  background.setAttribute("cy", "80");
  background.setAttribute("r", "54");
  background.setAttribute("class", "donut-background");
  svg.appendChild(background);

  const circumference = 2 * Math.PI * 54;
  let offset = 0;
  [...totals.entries()].forEach(([stage, amount], index) => {
    const portion = total === 0 ? 0 : amount / total;
    const segment = document.createElementNS(namespace, "circle");
    segment.setAttribute("cx", "80");
    segment.setAttribute("cy", "80");
    segment.setAttribute("r", "54");
    segment.setAttribute("class", "donut-segment");
    segment.setAttribute("stroke", chartColors[index % chartColors.length]);
    segment.setAttribute("stroke-dasharray", `${portion * circumference} ${circumference}`);
    segment.setAttribute("stroke-dashoffset", String(-offset * circumference));
    svg.appendChild(segment);
    offset += portion;

    const item = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = chartColors[index % chartColors.length];
    swatch.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = `${stage}: ${money(amount)} (${Math.round(portion * 100)}%)`;
    item.append(swatch, text);
    legend.appendChild(item);
  });

  const totalLabel = document.createElementNS(namespace, "text");
  totalLabel.setAttribute("x", "80");
  totalLabel.setAttribute("y", "76");
  totalLabel.setAttribute("class", "donut-label");
  totalLabel.textContent = "Pipeline";
  svg.appendChild(totalLabel);
  const totalValue = document.createElementNS(namespace, "text");
  totalValue.setAttribute("x", "80");
  totalValue.setAttribute("y", "94");
  totalValue.setAttribute("class", "donut-value");
  totalValue.textContent = money(total);
  svg.appendChild(totalValue);
}

function structured(result: { structuredContent?: Record<string, unknown>; content?: Array<{ type: string; text?: string }>; isError?: boolean }): Record<string, unknown> {
  if (result.isError) {
    const message = result.content?.find((item) => item.type === "text")?.text || "Tool execution failed.";
    throw new Error(message);
  }
  if (result.structuredContent) return result.structuredContent;
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("Tool returned no structured content.");
  return JSON.parse(text) as Record<string, unknown>;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  setStatus(`Loading ${name.replaceAll("_", " ")}...`);
  try {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
      app.callServerTool({ name, arguments: args }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${name.replaceAll("_", " ")} timed out. Retry the action.`)),
          TOOL_TIMEOUT_MS
        );
      }),
    ]).finally(() => {
      if (timeout) clearTimeout(timeout);
    });
    return structured(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(message, "error");
    throw error;
  }
}

function renderDashboard(data: Dashboard): void {
  state.dashboard = data;
  syncStageOptions(data.opportunities);
  applyFilters();
}

function syncStageOptions(opportunities: OpportunitySummary[]): void {
  const select = element<HTMLSelectElement>("filter-stage");
  const previous = select.value;
  const stages = [...new Set(opportunities.map((item) => item.stage))].sort((a, b) => a.localeCompare(b));
  clearChildren(select);
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "All stages";
  select.appendChild(all);
  for (const stage of stages) {
    const option = document.createElement("option");
    option.value = stage;
    option.textContent = stage;
    select.appendChild(option);
  }
  select.value = stages.includes(previous) ? previous : "";
}

function filterOpportunities(opportunities: OpportunitySummary[]): OpportunitySummary[] {
  const stage = element<HTMLSelectElement>("filter-stage").value;
  const search = element<HTMLInputElement>("filter-search").value.trim().toLowerCase();
  const minimumCents = Number(element<HTMLSelectElement>("filter-min").value) || 0;
  const sort = element<HTMLSelectElement>("filter-sort").value;

  const filtered = opportunities.filter((item) => {
    if (stage && item.stage !== stage) return false;
    if (item.amountCents < minimumCents) return false;
    if (search && !`${item.accountName} ${item.name}`.toLowerCase().includes(search)) return false;
    return true;
  });

  const comparators: Record<string, (a: OpportunitySummary, b: OpportunitySummary) => number> = {
    "amount-desc": (a, b) => b.amountCents - a.amountCents,
    "amount-asc": (a, b) => a.amountCents - b.amountCents,
    "close-asc": (a, b) => a.closeDate.localeCompare(b.closeDate),
    "probability-desc": (a, b) => b.probabilityBps - a.probabilityBps,
    "account-asc": (a, b) => a.accountName.localeCompare(b.accountName),
  };
  return filtered.sort(comparators[sort] || comparators["amount-desc"]);
}

function applyFilters(): void {
  const data = state.dashboard;
  if (!data) return;
  const visible = filterOpportunities(data.opportunities);
  const pipelineCents = visible.reduce((sum, item) => sum + item.amountCents, 0);
  const weightedCents = visible.reduce(
    (sum, item) => sum + Math.round((item.amountCents * item.probabilityBps) / 10000),
    0
  );

  setText("pipeline", money(pipelineCents));
  setText("weighted", money(weightedCents));
  setText("opportunity-count", String(visible.length));
  setText("provenance", data.provenance);
  setText(
    "filter-summary",
    visible.length === data.opportunities.length
      ? `Showing all ${data.opportunities.length} opportunities.`
      : `Showing ${visible.length} of ${data.opportunities.length} opportunities. Totals reflect the current filter.`
  );
  renderPipelineBars(visible);
  renderStageDonut(visible);
  renderOpportunityRows(visible);
  show("dashboard-view", "dashboard-title");
  setStatus("Dashboard ready.");
}

function renderOpportunityRows(opportunities: OpportunitySummary[]): void {
  const body = element<HTMLTableSectionElement>("opportunities");
  clearChildren(body);
  if (opportunities.length === 0) {
    const row = body.insertRow();
    const empty = row.insertCell();
    empty.colSpan = 5;
    empty.textContent = "No opportunities match the current filters.";
    return;
  }
  for (const opportunity of opportunities) {
    const row = body.insertRow();
    cell(row, opportunity.accountName);
    cell(row, opportunity.name);
    cell(row, opportunity.stage);
    cell(row, money(opportunity.amountCents));
    const action = row.insertCell();
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = "Open";
    button.setAttribute("aria-label", `Open ${opportunity.name} for ${opportunity.accountName}`);
    button.addEventListener("click", () => void loadOpportunity(opportunity.id));
    action.appendChild(button);
  }
}

function renderOpportunity(data: Opportunity, resetDraft = true): void {
  state.opportunity = data;
  if (resetDraft) state.draft = undefined;
  setText("opportunity-title", data.name);
  setText("account-name", data.accountName);
  setText("stage", data.stage);
  setText("close-date", data.closeDate);
  setText("owner", data.ownerName);
  setText("product-label", `${data.quoteCatalog[0].description} quantity (${money(data.quoteCatalog[0].unitPriceCents)} each)`);
  setText("service-label", `${data.quoteCatalog[1].description} quantity (${money(data.quoteCatalog[1].unitPriceCents)} each)`);
  setText("provenance", data.provenance);
  show("opportunity-view", "opportunity-title");
  setStatus("Opportunity ready. Edit quantities and discount, then preview.");
}

function renderDraft(data: Draft): void {
  state.draft = data;
  setText("draft-reference", `Draft ${data.draftId} - server revision ${data.revision}`);
  setText("identity", data.identityProven ? data.identityLabel : `${data.identityLabel} - production gate`);
  setText("provenance", data.provenance);
  const body = element<HTMLTableSectionElement>("quote-lines");
  clearChildren(body);
  for (const line of data.lines) {
    const row = body.insertRow();
    cell(row, `${line.description} (${line.sku})`);
    cell(row, String(line.quantity));
    cell(row, money(line.unitPriceCents));
    cell(row, money(line.lineTotalCents));
  }
  setText("subtotal", money(data.totals.subtotalCents));
  setText("discount", `${data.totals.discountBps / 100}% (${money(data.totals.discountCents)})`);
  setText("total", money(data.totals.totalCents));
  element<HTMLInputElement>("confirm-save").checked = false;
  element<HTMLButtonElement>("save-quote").disabled = true;
  show("quote-view", "quote-title");
  setStatus("Preview ready. Review it before explicitly confirming the simulated save.");
}

function renderSaved(data: SavedResult): void {
  state.quoteId = data.quote.quoteId;
  setText(
    "saved-reference",
    `${data.quote.quoteId} at revision ${data.quote.revision}${data.idempotent ? " (idempotent replay)" : ""}.`
  );
  show("saved-view", "saved-title");
  setStatus("SIMULATED quote saved. No CRM write occurred.", "success");
}

async function loadDashboard(): Promise<void> {
  const data = await callTool("get_sales_dashboard", {});
  renderDashboard(data as unknown as Dashboard);
}

async function loadOpportunity(opportunityId: string): Promise<void> {
  const data = await callTool("get_opportunity", { opportunityId });
  renderOpportunity(data as unknown as Opportunity);
}

async function preview(): Promise<void> {
  if (!state.opportunity) throw new Error("Open an opportunity first.");
  const request: Record<string, unknown> = {
    opportunityId: state.opportunity.id,
    productQuantity: element<HTMLInputElement>("product-quantity").valueAsNumber,
    serviceQuantity: element<HTMLInputElement>("service-quantity").valueAsNumber,
    discountBps: Number(element<HTMLSelectElement>("discount-bps").value),
  };
  if (state.draft) {
    request.draftId = state.draft.draftId;
    request.revision = state.draft.revision;
  }
  const data = await callTool("preview_quote", request);
  renderDraft(data as unknown as Draft);
}

async function save(): Promise<void> {
  if (!state.draft) throw new Error("Preview a quote first.");
  if (!element<HTMLInputElement>("confirm-save").checked) {
    throw new Error("Explicit confirmation is required.");
  }
  const data = await callTool("save_demo_quote", {
    draftId: state.draft.draftId,
    revision: state.draft.revision,
    confirmationToken: SAVE_CONFIRMATION_TOKEN,
    idempotencyKey: `sales-ui-${state.draft.draftId}-${state.draft.revision}`,
  });
  renderSaved(data as unknown as SavedResult);
}

function applyTheme(theme: string | undefined): void {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
}

element("refresh-dashboard").addEventListener("click", () => void loadDashboard());
element("filter-form").addEventListener("submit", (event) => event.preventDefault());
element("filter-form").addEventListener("input", () => applyFilters());
element("filter-form").addEventListener("change", () => applyFilters());
element("reset-filters").addEventListener("click", () => {
  element<HTMLSelectElement>("filter-stage").value = "";
  element<HTMLInputElement>("filter-search").value = "";
  element<HTMLSelectElement>("filter-min").value = "0";
  element<HTMLSelectElement>("filter-sort").value = "amount-desc";
  applyFilters();
});
element("back-dashboard").addEventListener("click", () => void loadDashboard());
element("saved-dashboard").addEventListener("click", () => void loadDashboard());
element("edit-quote").addEventListener("click", () => {
  if (state.opportunity) renderOpportunity(state.opportunity, false);
});
element("quote-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void preview();
});
element("confirm-save").addEventListener("change", () => {
  element<HTMLButtonElement>("save-quote").disabled = !element<HTMLInputElement>("confirm-save").checked;
});
element("save-quote").addEventListener("click", () => void save());
element("load-saved").addEventListener("click", async () => {
  if (!state.quoteId) return;
  const quote = await callTool("get_demo_quote", { quoteId: state.quoteId });
  setStatus(`Reloaded SIMULATED quote ${(quote as { quoteId: string }).quoteId}.`, "success");
});

app.addEventListener("toolresult", (params) => {
  try {
    const data = structured(params);
    if ("opportunities" in data) renderDashboard(data as unknown as Dashboard);
    else if ("quote" in data && "idempotent" in data) renderSaved(data as unknown as SavedResult);
    else if ("draftId" in data && "totals" in data) renderDraft(data as unknown as Draft);
    else if ("quoteCatalog" in data) renderOpportunity(data as unknown as Opportunity);
    else if ("quoteId" in data) setStatus(`Loaded SIMULATED quote ${String(data.quoteId)}.`, "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  }
});
app.addEventListener("hostcontextchanged", (context) => applyTheme(context.theme));

void (async () => {
  try {
    await app.connect();
    applyTheme(app.getHostContext()?.theme);
    setStatus("Connected. Waiting for tool data.");
  } catch (error) {
    setStatus(`Host connection failed: ${error instanceof Error ? error.message : String(error)}`, "error");
  }
})();
