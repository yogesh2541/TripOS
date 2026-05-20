/* eslint-disable jsx-a11y/alt-text */
// PDF rendering of a tax invoice via @react-pdf/renderer. Mirrors the visual
// structure of [invoice-preview.tsx](src/components/invoices/invoice-preview.tsx)
// but is print-optimized: A4, compact spacing, no interactive affordances.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { Invoice, InvoiceItem } from "@prisma/client";

const NAVY = "#0B1C2C";
const SAND = "#C8A96A";
const SAND_LIGHT = "#F0E5CB";
const INK = "#1A1A1A";
const MUTED = "#6E6E6E";
const LINE = "#E6E1D7";
const IVORY = "#FAF7F0";

type Snapshot = {
  legalName?: string | null;
  tradeName?: string | null;
  gstin?: string | null;
  pan?: string | null;
  logoUrl?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    stateCode?: string | null;
    pincode?: string | null;
    country?: string | null;
  } | null;
  contact?: {
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  } | null;
  signatory?: {
    name?: string | null;
    designation?: string | null;
  } | null;
  bank?: {
    name?: string | null;
    accountNumber?: string | null;
    ifsc?: string | null;
    holder?: string | null;
  } | null;
  invoiceTerms?: string | null;
  invoiceNotes?: string | null;
  // Recipient-only:
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
    fontSize: 9,
    color: INK,
    paddingBottom: 28,
  },
  hero: {
    backgroundColor: NAVY,
    paddingHorizontal: 32,
    paddingVertical: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroLogo: { width: 48, height: 48, marginBottom: 6, objectFit: "contain" },
  heroLabel: {
    color: SAND_LIGHT,
    fontSize: 7,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  heroSub: { color: SAND_LIGHT, fontSize: 8, marginTop: 2 },
  heroRight: { alignItems: "flex-end" },
  invoiceNumber: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    marginTop: 3,
    letterSpacing: 1,
  },
  sandBar: { height: 3, backgroundColor: SAND },

  // Body sections
  body: { paddingHorizontal: 32, paddingTop: 18 },
  twoCol: { flexDirection: "row", gap: 18, marginBottom: 14 },
  col: { flex: 1 },
  blockLabel: {
    fontSize: 7,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: MUTED,
    marginBottom: 4,
  },
  partyName: { fontFamily: "Helvetica-Bold", fontSize: 11, color: NAVY },
  partyLine: { fontSize: 8.5, marginTop: 1.5, color: INK },
  partyMuted: { fontSize: 8, marginTop: 1, color: MUTED },

  metaGrid: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    marginTop: 8,
    marginBottom: 14,
  },
  metaCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  metaLabel: {
    fontSize: 6.5,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: MUTED,
  },
  metaValue: { fontSize: 9, marginTop: 2, color: INK },

  // Items table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: IVORY,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: LINE,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  th: {
    fontSize: 7,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: MUTED,
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 0.25,
    borderBottomColor: LINE,
  },
  td: { fontSize: 9, color: INK },
  cellDesc: { flex: 4 },
  cellSac: { flex: 1, textAlign: "center" },
  cellQty: { flex: 1, textAlign: "right" },
  cellRate: { flex: 1.4, textAlign: "right" },
  cellAmt: { flex: 1.6, textAlign: "right" },

  // Totals
  totalsWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  totalsCard: {
    minWidth: 240,
    borderWidth: 0.5,
    borderColor: LINE,
    borderRadius: 4,
    padding: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
  },
  totalLabel: { fontSize: 9, color: MUTED },
  totalValue: { fontSize: 9, color: INK },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
  },
  grandLabel: { fontFamily: "Helvetica-Bold", fontSize: 11, color: NAVY },
  grandValue: { fontFamily: "Helvetica-Bold", fontSize: 13, color: NAVY },

  amountInWords: {
    marginTop: 10,
    paddingTop: 6,
    fontSize: 8.5,
    color: MUTED,
    fontStyle: "italic",
  },

  // Footer
  footerWrap: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  footerCol: { flex: 1 },
  signatureBox: {
    marginTop: 28,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    fontSize: 8,
    color: MUTED,
  },
  notes: { fontSize: 8.5, color: INK, marginTop: 4, lineHeight: 1.4 },
  pageFooter: {
    position: "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    textAlign: "center",
    color: MUTED,
    fontSize: 7,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
});

function formatINR(n: number): string {
  return "₹ " + Math.round(n).toLocaleString("en-IN");
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function joinAddress(a: Snapshot["address"]): string {
  if (!a) return "";
  return [a.line1, a.line2, [a.city, a.state, a.pincode].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

export function InvoiceDocument({
  invoice,
}: {
  invoice: Invoice & { items: InvoiceItem[] };
}) {
  const supplier = (invoice.supplierSnapshot as Snapshot | null) ?? null;
  const recipient = (invoice.recipientSnapshot as Snapshot | null) ?? null;
  const isIntraState = invoice.cgstAmount + invoice.sgstAmount > 0;

  return (
    <Document
      title={`Invoice ${invoice.invoiceNumber ?? "DRAFT"}`}
      author={supplier?.legalName ?? "TripCraft"}
    >
      <Page size="A4" style={styles.page}>
        {/* Hero */}
        <View style={styles.hero}>
          <View>
            {supplier?.logoUrl ? (
              <Image src={supplier.logoUrl} style={styles.heroLogo} />
            ) : null}
            <Text style={styles.heroLabel}>Tax invoice</Text>
            <Text style={styles.heroTitle}>{supplier?.legalName ?? "—"}</Text>
            {supplier?.tradeName ? (
              <Text style={styles.heroSub}>Trading as {supplier.tradeName}</Text>
            ) : null}
          </View>
          <View style={styles.heroRight}>
            <Text style={styles.heroLabel}>Invoice</Text>
            <Text style={styles.invoiceNumber}>
              {invoice.invoiceNumber ?? "DRAFT"}
            </Text>
            <Text style={styles.heroSub}>
              {invoice.status === "ISSUED"
                ? `Issued ${formatDate(invoice.issuedAt)}`
                : invoice.status === "CANCELLED"
                  ? `Cancelled ${formatDate(invoice.cancelledAt)}`
                  : `Drafted ${formatDate(invoice.createdAt)}`}
            </Text>
          </View>
        </View>
        <View style={styles.sandBar} />

        {/* Parties */}
        <View style={styles.body}>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.blockLabel}>Billed by</Text>
              <Text style={styles.partyName}>{supplier?.legalName ?? "—"}</Text>
              {joinAddress(supplier?.address) ? (
                <Text style={styles.partyLine}>
                  {joinAddress(supplier?.address)}
                </Text>
              ) : null}
              {supplier?.gstin ? (
                <Text style={styles.partyMuted}>GSTIN: {supplier.gstin}</Text>
              ) : null}
              {supplier?.contact?.email || supplier?.contact?.phone ? (
                <Text style={styles.partyMuted}>
                  {[supplier.contact?.email, supplier.contact?.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              ) : null}
            </View>
            <View style={styles.col}>
              <Text style={styles.blockLabel}>Billed to</Text>
              <Text style={styles.partyName}>{recipient?.name ?? "—"}</Text>
              {joinAddress(recipient?.address) ? (
                <Text style={styles.partyLine}>
                  {joinAddress(recipient?.address)}
                </Text>
              ) : null}
              {recipient?.gstin ? (
                <Text style={styles.partyMuted}>GSTIN: {recipient.gstin}</Text>
              ) : null}
              {recipient?.email || recipient?.phone ? (
                <Text style={styles.partyMuted}>
                  {[recipient?.email, recipient?.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Meta strip */}
          <View style={styles.metaGrid}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Invoice date</Text>
              <Text style={styles.metaValue}>{formatDate(invoice.invoiceDate)}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>FY</Text>
              <Text style={styles.metaValue}>{invoice.invoiceFy ?? "—"}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Place of supply</Text>
              <Text style={styles.metaValue}>
                {invoice.placeOfSupplyState ?? "—"}
                {invoice.placeOfSupplyStateCode
                  ? ` (${invoice.placeOfSupplyStateCode})`
                  : ""}
              </Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Tax</Text>
              <Text style={styles.metaValue}>
                {invoice.taxRatePct}% · {isIntraState ? "CGST+SGST" : "IGST"}
              </Text>
            </View>
          </View>

          {/* Items */}
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.cellDesc]}>Description</Text>
            <Text style={[styles.th, styles.cellSac]}>SAC</Text>
            <Text style={[styles.th, styles.cellQty]}>Qty</Text>
            <Text style={[styles.th, styles.cellRate]}>Rate</Text>
            <Text style={[styles.th, styles.cellAmt]}>Taxable</Text>
          </View>
          {invoice.items.map((it) => (
            <View key={it.id} style={styles.tr}>
              <Text style={[styles.td, styles.cellDesc]}>{it.description}</Text>
              <Text style={[styles.td, styles.cellSac]}>{it.sacCode}</Text>
              <Text style={[styles.td, styles.cellQty]}>{it.quantity}</Text>
              <Text style={[styles.td, styles.cellRate]}>
                {formatINR(it.unitPrice)}
              </Text>
              <Text style={[styles.td, styles.cellAmt]}>
                {formatINR(it.taxableValue)}
              </Text>
            </View>
          ))}

          {/* Totals */}
          <View style={styles.totalsWrap}>
            <View style={styles.totalsCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{formatINR(invoice.subtotal)}</Text>
              </View>
              {isIntraState ? (
                <>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>
                      CGST {invoice.taxRatePct / 2}%
                    </Text>
                    <Text style={styles.totalValue}>
                      {formatINR(invoice.cgstAmount)}
                    </Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>
                      SGST {invoice.taxRatePct / 2}%
                    </Text>
                    <Text style={styles.totalValue}>
                      {formatINR(invoice.sgstAmount)}
                    </Text>
                  </View>
                </>
              ) : invoice.igstAmount > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    IGST {invoice.taxRatePct}%
                  </Text>
                  <Text style={styles.totalValue}>
                    {formatINR(invoice.igstAmount)}
                  </Text>
                </View>
              ) : null}
              {invoice.roundOff !== 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Round off</Text>
                  <Text style={styles.totalValue}>
                    {formatINR(invoice.roundOff)}
                  </Text>
                </View>
              ) : null}
              <View style={styles.grandRow}>
                <Text style={styles.grandLabel}>Total payable</Text>
                <Text style={styles.grandValue}>
                  {formatINR(invoice.grandTotal)}
                </Text>
              </View>
            </View>
          </View>

          {invoice.amountInWords ? (
            <Text style={styles.amountInWords}>
              In words: {invoice.amountInWords}
            </Text>
          ) : null}

          {/* Footer */}
          <View style={styles.footerWrap}>
            <View style={styles.footerCol}>
              {supplier?.bank?.accountNumber ? (
                <>
                  <Text style={styles.blockLabel}>Bank details</Text>
                  <Text style={styles.notes}>
                    {supplier.bank.name ?? "—"}
                    {"\n"}A/C {supplier.bank.accountNumber}
                    {"\n"}IFSC {supplier.bank.ifsc ?? "—"}
                    {supplier.bank.holder ? `\n${supplier.bank.holder}` : ""}
                  </Text>
                </>
              ) : null}
              {supplier?.invoiceNotes ? (
                <>
                  <Text style={[styles.blockLabel, { marginTop: 8 }]}>
                    Notes
                  </Text>
                  <Text style={styles.notes}>{supplier.invoiceNotes}</Text>
                </>
              ) : null}
              {supplier?.invoiceTerms ? (
                <>
                  <Text style={[styles.blockLabel, { marginTop: 8 }]}>
                    Terms
                  </Text>
                  <Text style={styles.notes}>{supplier.invoiceTerms}</Text>
                </>
              ) : null}
            </View>
            <View style={styles.footerCol}>
              <View style={styles.signatureBox}>
                <Text style={{ color: INK, fontSize: 9 }}>
                  For {supplier?.legalName ?? "—"}
                </Text>
                {supplier?.signatory?.name ? (
                  <Text style={{ color: MUTED, fontSize: 8, marginTop: 18 }}>
                    {supplier.signatory.name}
                    {supplier.signatory.designation
                      ? ` · ${supplier.signatory.designation}`
                      : ""}
                  </Text>
                ) : (
                  <Text style={{ color: MUTED, fontSize: 8, marginTop: 18 }}>
                    Authorized signatory
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        <Text
          style={styles.pageFooter}
          render={({ pageNumber, totalPages }) =>
            `Invoice ${invoice.invoiceNumber ?? "DRAFT"} · Page ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
