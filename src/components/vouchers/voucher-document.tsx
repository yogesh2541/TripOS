/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { VoucherSnapshot } from "@/server/services/vouchers";

const NAVY = "#0B1C2C";
const SAND = "#C8A96A";
const SAND_LIGHT = "#F0E5CB";
const INK = "#1A1A1A";
const MUTED = "#6E6E6E";
const LINE = "#E6E1D7";
const IVORY = "#FAF7F0";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
    fontSize: 10,
    color: INK,
    paddingTop: 0,
    paddingBottom: 36,
    paddingHorizontal: 0,
  },
  // Hero band
  hero: {
    backgroundColor: NAVY,
    paddingHorizontal: 36,
    paddingVertical: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroLeft: {
    flexDirection: "column",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: SAND,
    marginRight: 6,
  },
  brand: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    letterSpacing: 1,
  },
  brandTagline: {
    color: SAND_LIGHT,
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 2,
  },
  heroRight: {
    alignItems: "flex-end",
  },
  voucherNumberLabel: {
    color: SAND_LIGHT,
    fontSize: 7,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  voucherNumber: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    marginTop: 2,
    letterSpacing: 1,
  },
  voucherDate: {
    color: SAND_LIGHT,
    fontSize: 8,
    marginTop: 4,
  },
  // Sand accent stripe
  accent: { height: 3, backgroundColor: SAND },
  // Body
  body: { paddingHorizontal: 36, paddingTop: 24 },
  // Subject row
  subjectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  category: {
    fontSize: 8,
    color: SAND,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  serviceTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    lineHeight: 1.2,
  },
  conf: {
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    letterSpacing: 1,
    backgroundColor: SAND_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  // Two-column layout
  cols: { flexDirection: "row", gap: 18, marginTop: 12 },
  colMain: { flex: 1.4 },
  colSide: { flex: 1 },

  // Section
  sectionLabel: {
    fontSize: 7,
    color: MUTED,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  card: {
    backgroundColor: IVORY,
    borderRadius: 8,
    padding: 14,
    borderLeftWidth: 2,
    borderLeftColor: SAND,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 8,
  },
  // Field
  fieldRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  fieldRowLast: {
    flexDirection: "row",
    paddingVertical: 4,
  },
  fieldLabel: {
    width: 90,
    fontSize: 8,
    color: MUTED,
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingTop: 1,
  },
  fieldValue: {
    flex: 1,
    fontSize: 10,
    color: INK,
  },
  fieldValueStrong: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },

  description: {
    fontSize: 10,
    color: INK,
    lineHeight: 1.5,
    marginTop: 4,
  },

  // QR block
  qrCard: {
    alignItems: "center",
    backgroundColor: IVORY,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  qrImage: { width: 110, height: 110 },
  qrCaption: {
    fontSize: 8,
    color: MUTED,
    marginTop: 6,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // Emergency strip
  emergency: {
    marginTop: 12,
    backgroundColor: NAVY,
    color: "#FFFFFF",
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emergencyLabel: {
    color: SAND_LIGHT,
    fontSize: 7,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  emergencyValue: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 16,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
  },
  footerText: {
    fontSize: 7,
    color: MUTED,
    letterSpacing: 1,
  },
});

const CATEGORY_LABEL: Record<string, string> = {
  HOTEL: "Hotel voucher",
  TRANSFER: "Transfer voucher",
  SIGHTSEEING: "Sightseeing voucher",
  ACTIVITY: "Activity voucher",
  GUIDE: "Guide voucher",
  FLIGHT: "Flight voucher",
  TRAIN: "Train voucher",
  OTHER: "Service voucher",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function locationLine(v: VoucherSnapshot["vendor"]) {
  return [v.city, v.state, v.country].filter(Boolean).join(", ");
}

export function VoucherDocument({
  snapshot,
  qrDataUrl,
}: {
  snapshot: VoucherSnapshot;
  qrDataUrl: string | null;
}) {
  const cat = snapshot.service.category;
  const stayLine =
    snapshot.service.startDate && snapshot.service.endDate
      ? `${fmtDate(snapshot.service.startDate)} → ${fmtDate(snapshot.service.endDate)}`
      : snapshot.service.startDate
        ? fmtDate(snapshot.service.startDate)
        : "—";

  return (
    <Document
      title={snapshot.voucherNumber}
      author={snapshot.agency.name}
      subject={`${snapshot.vendor.name} — ${snapshot.service.title}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <View style={styles.brandRow}>
              <View style={styles.brandDot} />
              <Text style={styles.brand}>{snapshot.agency.name.toUpperCase()}</Text>
            </View>
            <Text style={styles.brandTagline}>
              Crafted travel · Voucher of service
            </Text>
          </View>
          <View style={styles.heroRight}>
            <Text style={styles.voucherNumberLabel}>Voucher</Text>
            <Text style={styles.voucherNumber}>{snapshot.voucherNumber}</Text>
            <Text style={styles.voucherDate}>
              Issued {fmtDate(snapshot.generatedAt)}
            </Text>
          </View>
        </View>
        <View style={styles.accent} />

        {/* Body */}
        <View style={styles.body}>
          <View style={styles.subjectRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.category}>
                {CATEGORY_LABEL[cat] ?? CATEGORY_LABEL.OTHER}
              </Text>
              <Text style={styles.serviceTitle}>
                {snapshot.service.title}
              </Text>
            </View>
            {snapshot.service.confirmationNumber ? (
              <View>
                <Text style={styles.sectionLabel}>Confirmation</Text>
                <Text style={styles.conf}>
                  {snapshot.service.confirmationNumber}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.cols}>
            {/* MAIN COL */}
            <View style={styles.colMain}>
              <Text style={styles.sectionLabel}>Traveler</Text>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {snapshot.traveler.leadName ?? "—"}
                </Text>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Pax</Text>
                  <Text style={styles.fieldValue}>
                    {snapshot.traveler.travelers}{" "}
                    {snapshot.traveler.travelers === 1 ? "guest" : "guests"}
                  </Text>
                </View>
                {snapshot.traveler.phone ? (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Phone</Text>
                    <Text style={styles.fieldValue}>
                      {snapshot.traveler.phone}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.fieldRowLast}>
                  <Text style={styles.fieldLabel}>Trip</Text>
                  <Text style={styles.fieldValue}>
                    {snapshot.trip.destination} · {snapshot.trip.days}{" "}
                    {snapshot.trip.days === 1 ? "day" : "days"}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Service details</Text>
              <View style={styles.card}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Dates</Text>
                  <Text style={styles.fieldValueStrong}>{stayLine}</Text>
                </View>
                {snapshot.service.quantity ? (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Quantity</Text>
                    <Text style={styles.fieldValue}>
                      {snapshot.service.quantity}
                    </Text>
                  </View>
                ) : null}
                {snapshot.service.description ? (
                  <View style={styles.fieldRowLast}>
                    <Text style={styles.fieldLabel}>Includes</Text>
                    <Text style={styles.fieldValue}>
                      {snapshot.service.description}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* SIDE COL */}
            <View style={styles.colSide}>
              <Text style={styles.sectionLabel}>Vendor</Text>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{snapshot.vendor.name}</Text>
                {snapshot.vendor.address ? (
                  <Text style={[styles.fieldValue, { marginBottom: 6 }]}>
                    {snapshot.vendor.address}
                  </Text>
                ) : null}
                {locationLine(snapshot.vendor) ? (
                  <Text style={[styles.fieldValue, { marginBottom: 6 }]}>
                    {locationLine(snapshot.vendor)}
                  </Text>
                ) : null}
                {snapshot.vendor.phone ? (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Phone</Text>
                    <Text style={styles.fieldValue}>{snapshot.vendor.phone}</Text>
                  </View>
                ) : null}
                {snapshot.vendor.whatsapp ? (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>WhatsApp</Text>
                    <Text style={styles.fieldValue}>
                      {snapshot.vendor.whatsapp}
                    </Text>
                  </View>
                ) : null}
                {snapshot.vendor.email ? (
                  <View style={styles.fieldRowLast}>
                    <Text style={styles.fieldLabel}>Email</Text>
                    <Text style={styles.fieldValue}>{snapshot.vendor.email}</Text>
                  </View>
                ) : null}
              </View>

              {qrDataUrl ? (
                <View style={styles.qrCard}>
                  <Image src={qrDataUrl} style={styles.qrImage} />
                  <Text style={styles.qrCaption}>Scan to view online</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.emergency}>
            <View>
              <Text style={styles.emergencyLabel}>24×7 Emergency</Text>
              <Text style={styles.emergencyValue}>
                {snapshot.agency.emergencyPhone}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.emergencyLabel}>Concierge</Text>
              <Text style={[styles.emergencyValue, { fontSize: 10 }]}>
                {snapshot.agency.email}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {snapshot.agency.name.toUpperCase()} · {snapshot.agency.phone}
          </Text>
          <Text style={styles.footerText}>
            VOUCHER {snapshot.voucherNumber}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
