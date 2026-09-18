import { Opportunity, QuoteLine, QuoteTotals } from "./salesTypes";

export interface QuoteInput {
  productQuantity: number;
  serviceQuantity: number;
  discountBps: number;
}

export function validateQuoteInput(input: QuoteInput): void {
  for (const [name, value] of [
    ["productQuantity", input.productQuantity],
    ["serviceQuantity", input.serviceQuantity],
    ["discountBps", input.discountBps],
  ] as const) {
    if (!Number.isInteger(value)) {
      throw new Error(`${name} must be an integer.`);
    }
  }
  if (input.productQuantity < 0 || input.productQuantity > 1000) {
    throw new Error("productQuantity must be between 0 and 1000.");
  }
  if (input.serviceQuantity < 0 || input.serviceQuantity > 100) {
    throw new Error("serviceQuantity must be between 0 and 100.");
  }
  if (input.productQuantity + input.serviceQuantity === 0) {
    throw new Error("At least one quote quantity must be greater than zero.");
  }
  if (input.discountBps < 0 || input.discountBps > 5000) {
    throw new Error("discountBps must be between 0 and 5000.");
  }
}

export function calculateQuote(opportunity: Opportunity, input: QuoteInput): { lines: QuoteLine[]; totals: QuoteTotals } {
  validateQuoteInput(input);
  const quantities = [input.productQuantity, input.serviceQuantity];
  const lines = opportunity.quoteCatalog.map((item, index) => ({
    ...item,
    quantity: quantities[index],
    lineTotalCents: item.unitPriceCents * quantities[index],
  }));
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const discountCents = Math.round((subtotalCents * input.discountBps) / 10000);
  return {
    lines,
    totals: {
      subtotalCents,
      discountBps: input.discountBps,
      discountCents,
      totalCents: subtotalCents - discountCents,
    },
  };
}
