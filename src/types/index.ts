export type LineItemCategory = "Hotel" | "Transport" | "Activities" | "Flights" | "Other";

export type PricingItem = {
  id: string;
  category: LineItemCategory;
  label: string;
  cost: number;
};

export type PricingState = {
  items: PricingItem[];
  markupPct: number;
  discountPct?: number;
};

export type PricingSummary = {
  totalCost: number;
  markupAmount: number;
  discountAmount: number;
  sellingPrice: number;
  profit: number;
};

export function computePricing(state: PricingState): PricingSummary {
  const totalCost = state.items.reduce(
    (sum, i) => sum + (Number(i.cost) || 0),
    0
  );
  const markupPct = Number(state.markupPct) || 0;
  const discountPct = Number(state.discountPct) || 0;
  const markupAmount = Math.round(totalCost * (markupPct / 100));
  const gross = totalCost + markupAmount;
  const discountAmount = Math.round(gross * (discountPct / 100));
  const sellingPrice = gross - discountAmount;
  const profit = sellingPrice - totalCost;
  return { totalCost, markupAmount, discountAmount, sellingPrice, profit };
}

// === Customer-facing pricing ===
//
// A proposal must NEVER expose the agency's cost, markup or profit. This
// builder distributes the final selling price pro-rata across each line
// item's cost and groups by category — so the customer sees clean,
// all-in selling amounts per category that sum exactly to the total, with
// the markup mathematically invisible.

export type ProposalCategoryLine = {
  category: LineItemCategory;
  /** Customer-friendly category name. */
  label: string;
  amount: number;
};

export type ProposalPricing = {
  categories: ProposalCategoryLine[];
  total: number;
  perPerson: number;
  travelers: number;
};

const CATEGORY_DISPLAY: Record<LineItemCategory, string> = {
  Hotel: "Accommodation",
  Transport: "Transfers & transport",
  Activities: "Experiences & activities",
  Flights: "Flights",
  Other: "Other services",
};

const CATEGORY_ORDER: LineItemCategory[] = [
  "Flights",
  "Hotel",
  "Transport",
  "Activities",
  "Other",
];

export function buildProposalPricing(
  state: PricingState & { travelers: number }
): ProposalPricing {
  const { totalCost, sellingPrice } = computePricing(state);
  const travelers = Math.max(1, Math.round(Number(state.travelers) || 1));

  // Pro-rata: each item's share of the selling price ∝ its share of cost.
  const byCat = new Map<LineItemCategory, number>();
  for (const it of state.items) {
    const cost = Number(it.cost) || 0;
    const share = totalCost > 0 ? (cost / totalCost) * sellingPrice : 0;
    byCat.set(it.category, (byCat.get(it.category) ?? 0) + share);
  }

  const categories: ProposalCategoryLine[] = CATEGORY_ORDER.filter((c) =>
    byCat.has(c)
  ).map((category) => ({
    category,
    label: CATEGORY_DISPLAY[category],
    amount: Math.round(byCat.get(category) ?? 0),
  }));

  // Absorb any rounding residual into the largest category so the lines
  // sum *exactly* to the selling price — no "₹1 off" on a proposal.
  const summed = categories.reduce((s, c) => s + c.amount, 0);
  const residual = sellingPrice - summed;
  if (residual !== 0 && categories.length > 0) {
    const largest = categories.reduce((a, b) =>
      b.amount > a.amount ? b : a
    );
    largest.amount += residual;
  }

  return {
    categories,
    total: sellingPrice,
    perPerson: Math.round(sellingPrice / travelers),
    travelers,
  };
}
