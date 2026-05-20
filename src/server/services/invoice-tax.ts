import "server-only";
import type {
  InvoiceTaxScheme,
  TaxableBasis,
} from "@prisma/client";

export type TaxComputationLineInput = {
  description: string;
  sacCode: string;
  quantity: number;
  unitPrice: number;
  /** Required when taxableBasis = MARGIN_ONLY. Ignored otherwise. */
  cost?: number | null;
};

export type TaxComputationInput = {
  scheme: InvoiceTaxScheme;
  basis: TaxableBasis;
  /** Supplier (agency) state code — drives intra/inter-state determination. */
  supplierStateCode: string | null | undefined;
  /** Place of supply state code — recipient or trip destination. */
  placeOfSupplyStateCode: string | null | undefined;
  lines: TaxComputationLineInput[];
};

export type TaxComputationLineResult = TaxComputationLineInput & {
  taxableValue: number;
  taxRatePct: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
};

export type TaxComputationResult = {
  scheme: InvoiceTaxScheme;
  basis: TaxableBasis;
  taxRatePct: number;
  isIntraState: boolean;
  lines: TaxComputationLineResult[];
  subtotal: number; // sum of line.taxableValue
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxTotal: number;
  roundOff: number;
  grandTotalPreRound: number; // before round-off
  grandTotal: number; // after round-off (whole rupees)
};

/** Tax rate (as percent) for each scheme. EXEMPT = 0%. */
const RATE_BY_SCHEME: Record<InvoiceTaxScheme, number> = {
  GST_5_NO_ITC: 5,
  GST_18_REGULAR: 18,
  EXEMPT: 0,
};

/**
 * Pure tax computation. No side effects, no DB. All currency math is rounded
 * to 2 decimals at line level; invoice grand total is rounded to whole rupees
 * with the difference captured as roundOff.
 *
 * Supplier vs place-of-supply state code drives the split:
 *   same state  → CGST + SGST (each = rate / 2)
 *   different   → IGST (= rate)
 *
 * Intentionally deferring to higher levels:
 *   - intermediary services (Sec 13(8)(b))
 *   - exports / SEZ (treat as EXEMPT for now)
 *   - reverse charge
 *   - corporate B2B treatments (TDS / TCS)
 */
export function computeInvoiceTaxes(
  input: TaxComputationInput
): TaxComputationResult {
  const taxRatePct = RATE_BY_SCHEME[input.scheme];
  const isIntraState =
    !!input.supplierStateCode &&
    !!input.placeOfSupplyStateCode &&
    input.supplierStateCode === input.placeOfSupplyStateCode;

  const lines: TaxComputationLineResult[] = input.lines.map((l) => {
    const lineTotal = round2(l.quantity * l.unitPrice);
    const taxableValue = round2(taxableValueFor(input.basis, lineTotal, l.cost));
    const taxOnLine = round2((taxableValue * taxRatePct) / 100);

    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    if (taxRatePct > 0) {
      if (isIntraState) {
        cgst = round2(taxOnLine / 2);
        sgst = round2(taxOnLine - cgst); // absorb rounding into SGST
      } else {
        igst = taxOnLine;
      }
    }

    return {
      ...l,
      taxableValue,
      taxRatePct,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
    };
  });

  const subtotal = round2(sum(lines.map((l) => l.taxableValue)));
  const cgstAmount = round2(sum(lines.map((l) => l.cgstAmount)));
  const sgstAmount = round2(sum(lines.map((l) => l.sgstAmount)));
  const igstAmount = round2(sum(lines.map((l) => l.igstAmount)));
  const taxTotal = round2(cgstAmount + sgstAmount + igstAmount);

  // When basis is SERVICE_FEE_ONLY or MARGIN_ONLY, only the taxable portion
  // attracts GST but the recipient still pays the full sale value. So the
  // grand total = gross sale + tax on (taxable portion).
  const grossSale = round2(
    sum(input.lines.map((l) => round2(l.quantity * l.unitPrice)))
  );
  const grandTotalPreRound = round2(grossSale + taxTotal);
  const grandTotal = Math.round(grandTotalPreRound);
  const roundOff = round2(grandTotal - grandTotalPreRound);

  return {
    scheme: input.scheme,
    basis: input.basis,
    taxRatePct,
    isIntraState,
    lines,
    subtotal,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxTotal,
    roundOff,
    grandTotalPreRound: round2(grandTotalPreRound),
    grandTotal,
  };
}

function taxableValueFor(
  basis: TaxableBasis,
  lineTotal: number,
  cost: number | null | undefined
): number {
  switch (basis) {
    case "FULL_AMOUNT":
      return lineTotal;
    case "SERVICE_FEE_ONLY":
      // Without a separate fee field on the line yet, fall back to lineTotal.
      // The schema is intentionally future-proof: when a fee field is added,
      // this branch updates without touching callers.
      return lineTotal;
    case "MARGIN_ONLY": {
      if (typeof cost !== "number") return 0;
      return Math.max(0, round2(lineTotal - cost));
    }
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
