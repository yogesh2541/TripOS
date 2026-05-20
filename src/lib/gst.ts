/**
 * GST domain primitives kept off the server boundary so client pickers can
 * reuse them. No prisma / server-only imports here.
 */

export type StateOption = {
  code: string; // GST state code (2-digit)
  name: string;
};

/**
 * Indian GST state codes — source of truth for the place-of-supply picker.
 * Includes states + UTs as per GST master.
 */
export const INDIA_STATES: StateOption[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "25", name: "Daman and Diu" }, // legacy; merged into 26 from 2020
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "28", name: "Andhra Pradesh (before division)" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "97", name: "Other Territory" },
  { code: "99", name: "Centre Jurisdiction" },
];

export const STATE_NAME_BY_CODE: Record<string, string> = Object.fromEntries(
  INDIA_STATES.map((s) => [s.code, s.name])
);

/**
 * Indian fiscal year runs April 1 → March 31. Returns "YY-YY" e.g. "26-27".
 */
export function fiscalYearFor(date: Date): string {
  const month = date.getMonth(); // 0-indexed; 3 = April
  const year = date.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  const yy = (n: number) => String(n).slice(-2).padStart(2, "0");
  return `${yy(startYear)}-${yy(startYear + 1)}`;
}

/** Format a sequence number into the canonical invoice-number string. */
export function formatInvoiceNumber(opts: {
  prefix: string;
  fiscalYear: string;
  sequence: number;
  width?: number;
}): string {
  const width = opts.width ?? 4;
  const seq = String(opts.sequence).padStart(width, "0");
  return `${opts.prefix}/${opts.fiscalYear}/${seq}`;
}

/**
 * Bankers-style INR amount in words. Indian numbering (lakh/crore).
 * Returns "Indian Rupees Twelve Thousand Five Hundred Only" etc.
 */
export function amountInWordsINR(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const negative = value < 0;
  const abs = Math.abs(value);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);

  const rupeePart = numberToIndianWords(rupees);
  const paisePart = paise > 0 ? ` and ${numberToIndianWords(paise)} Paise` : "";
  const out = `Indian Rupees ${rupeePart || "Zero"}${paisePart} Only`;
  return negative ? `(Negative) ${out}` : out;
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigit(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return TENS[t] + (u ? " " + ONES[u] : "");
}

function threeDigit(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const head = h ? ONES[h] + " Hundred" : "";
  if (r === 0) return head;
  return head ? head + " " + twoDigit(r) : twoDigit(r);
}

function numberToIndianWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n -= crore * 10000000;
  const lakh = Math.floor(n / 100000);
  n -= lakh * 100000;
  const thousand = Math.floor(n / 1000);
  n -= thousand * 1000;
  const rest = n;

  if (crore) parts.push(twoDigit(crore) + " Crore");
  if (lakh) parts.push(twoDigit(lakh) + " Lakh");
  if (thousand) parts.push(twoDigit(thousand) + " Thousand");
  if (rest) parts.push(threeDigit(rest));

  return parts.join(" ").trim();
}

/** Indian-locale comma grouping (1,23,456). */
export function formatINRPlain(value: number): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
