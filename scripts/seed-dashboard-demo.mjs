// Seeds demo data so every block on /operations renders meaningfully.
// Re-run anytime — it wipes its own [DEMO]-tagged data first.
//
//   node scripts/seed-dashboard-demo.mjs
//
// Cleanup with:  node scripts/clean-dashboard-demo.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TAG = "[DEMO]";

const today = new Date();
today.setHours(0, 0, 0, 0);
const daysAgo = (n) => new Date(today.getTime() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000);

async function clean() {
  // Delete trips (assignments + tasks + activities cascade)
  await prisma.trip.deleteMany({ where: { notes: { contains: TAG } } });
  // Delete leads with [DEMO] tag (these are the auto-created Direct leads)
  await prisma.lead.deleteMany({ where: { notes: { contains: TAG } } });
  // Vendors are restricted by assignments → trips were deleted, so safe now
  await prisma.vendor.deleteMany({ where: { notes: { contains: TAG } } });
  console.log("cleaned existing [DEMO] data");
}

async function main() {
  await clean();

  // 1. Demo user (reuse the demo user that other parts of the app use)
  const user = await prisma.user.upsert({
    where: { email: "demo@tripcraft.app" },
    update: {},
    create: { email: "demo@tripcraft.app" },
  });

  // 2. Two demo leads (so trips have lead context)
  const baliLead = await prisma.lead.create({
    data: {
      userId: user.id,
      name: "Aanya & Rohan Sharma",
      phone: "+91 98123 45670",
      email: "aanya.sharma@example.in",
      source: "INSTAGRAM",
      status: "WON",
      destination: "Bali",
      adults: 2,
      budget: 250000,
      notes: `${TAG} Honeymoon couple, prefers boutique villas with private pools.`,
    },
  });

  const keralaLead = await prisma.lead.create({
    data: {
      userId: user.id,
      name: "Mehta family",
      phone: "+91 99876 54321",
      email: "vivek.mehta@example.in",
      source: "REFERRAL",
      status: "WON",
      destination: "Kerala",
      adults: 4,
      budget: 180000,
      notes: `${TAG} Family of four with two kids (8 & 12). Slow-paced.`,
    },
  });

  // 3. Vendors
  const tugu = await prisma.vendor.create({
    data: {
      name: "Tugu Bali (DEMO)",
      type: "HOTEL",
      city: "Canggu",
      country: "Indonesia",
      phone: "+62 361 731701",
      email: "reservations@tuguhotels.com",
      isPreferred: true,
      paymentTerms: "30% on booking, 70% before check-in",
      notes: `${TAG} Boutique heritage hotel — usually 24-48hr confirmation turnaround.`,
    },
  });

  const houseboat = await prisma.vendor.create({
    data: {
      name: "Spice Coast Cruises (DEMO)",
      type: "HOTEL",
      city: "Alleppey",
      state: "Kerala",
      country: "India",
      phone: "+91 477 224 1133",
      whatsapp: "919847012345",
      email: "bookings@spicecoast.example",
      paymentTerms: "100% on confirmation",
      notes: `${TAG} Heritage 1-bedroom houseboats. Confirms within 4 hrs on WhatsApp.`,
    },
  });

  const driver = await prisma.vendor.create({
    data: {
      name: "Suresh Nair — Driver (DEMO)",
      type: "DRIVER",
      city: "Kochi",
      state: "Kerala",
      country: "India",
      phone: "+91 98470 11111",
      whatsapp: "919847011111",
      isPreferred: true,
      notes: `${TAG} 12 years experience, English-speaking, owns Innova Crysta.`,
    },
  });

  // 4. TRIP A — Bali, departs TODAY, status BOOKED, vendors still PENDING/REQUESTED
  const bali = await prisma.trip.create({
    data: {
      userId: user.id,
      leadId: baliLead.id,
      destination: "Bali",
      days: 6,
      travelers: 2,
      startDate: today,
      budget: 250000,
      travelType: "Honeymoon",
      pace: "Relaxed",
      hotelType: "Boutique",
      interests: ["beaches", "spa", "fine dining"],
      notes: `${TAG} Bali honeymoon`,
      status: "BOOKED",
    },
  });

  // 5. TRIP B — Kerala, status IN_PROGRESS (departed 3 days ago, ends 5 days from now)
  const kerala = await prisma.trip.create({
    data: {
      userId: user.id,
      leadId: keralaLead.id,
      destination: "Kerala",
      days: 8,
      travelers: 4,
      startDate: daysAgo(3),
      budget: 180000,
      travelType: "Family",
      pace: "Relaxed",
      hotelType: "Heritage",
      interests: ["backwaters", "ayurveda", "wildlife"],
      notes: `${TAG} Kerala family trip`,
      status: "IN_PROGRESS",
    },
  });

  // 6. Vendor assignments
  // Bali: BOTH still awaiting confirmation → "Awaiting vendor confirmation" card
  await prisma.vendorAssignment.create({
    data: {
      tripId: bali.id,
      vendorId: tugu.id,
      category: "HOTEL",
      title: "5 nights — Walter Spies Pavilion (BB)",
      description: "Lake-facing pavilion, breakfast included.",
      startDate: today,
      endDate: daysFromNow(5),
      quantity: 5,
      unitCost: 16000,
      totalCost: 80000,
      sellingPrice: 105000,
      status: "PENDING",
      notes: `${TAG}`,
    },
  });
  await prisma.vendorAssignment.create({
    data: {
      tripId: bali.id,
      vendorId: driver.id,
      category: "TRANSFER",
      title: "Airport transfers + 3 days at-disposal",
      startDate: today,
      endDate: daysFromNow(3),
      totalCost: 14000,
      sellingPrice: 18000,
      status: "REQUESTED",
      notes: `${TAG}`,
    },
  });

  // Kerala: confirmed (trip is in progress)
  await prisma.vendorAssignment.create({
    data: {
      tripId: kerala.id,
      vendorId: houseboat.id,
      category: "HOTEL",
      title: "2 nights — Heritage 1BHK Houseboat (FB)",
      description: "Full board, sundeck, AC bedroom.",
      startDate: daysAgo(3),
      endDate: daysAgo(1),
      quantity: 2,
      unitCost: 30000,
      totalCost: 60000,
      sellingPrice: 78000,
      status: "CONFIRMED",
      confirmationNumber: "SCC-77182",
      notes: `${TAG}`,
    },
  });
  await prisma.vendorAssignment.create({
    data: {
      tripId: kerala.id,
      vendorId: driver.id,
      category: "TRANSFER",
      title: "8-day at-disposal Innova Crysta",
      startDate: daysAgo(3),
      endDate: daysFromNow(5),
      quantity: 8,
      unitCost: 4000,
      totalCost: 32000,
      sellingPrice: 42000,
      status: "CONFIRMED",
      confirmationNumber: "SN-9921",
      notes: `${TAG}`,
    },
  });

  // 7. Overdue ops task (on Bali — was due 2 days ago, still pending)
  await prisma.operationTask.create({
    data: {
      tripId: bali.id,
      title: "Collect passport copies & visa-on-arrival forms",
      description: `${TAG} Need scanned copies for hotel check-in.`,
      type: "DOCUMENT_COLLECTION",
      priority: "HIGH",
      status: "PENDING",
      dueDate: daysAgo(2),
    },
  });

  // 8. Vendor payments — pay the driver in full, but leave hotel balances open
  // Driver: 14k (Bali) + 32k (Kerala) committed = 46k. Pay 46k → balance 0.
  await prisma.vendorPayment.create({
    data: {
      vendorId: driver.id,
      tripId: kerala.id,
      amount: 46000,
      paymentDate: daysAgo(3),
      mode: "UPI",
      reference: "UPI/SN-9921",
      notes: `${TAG} cleared driver dues`,
    },
  });
  // Tugu: 80k committed, 24k advance paid → balance 56k outstanding
  await prisma.vendorPayment.create({
    data: {
      vendorId: tugu.id,
      tripId: bali.id,
      amount: 24000,
      paymentDate: daysAgo(7),
      mode: "BANK",
      reference: "RTGS/TUGU-001",
      notes: `${TAG} 30% advance`,
    },
  });
  // Houseboat: 60k committed, 0 paid → balance 60k outstanding

  // 9. A handful of activity entries so "Recent operational activity" looks alive
  await prisma.activity.createMany({
    data: [
      {
        tripId: kerala.id,
        leadId: keralaLead.id,
        vendorId: houseboat.id,
        type: "VENDOR_CONFIRMED",
        title: `Confirmed Spice Coast Cruises · 2 nights houseboat`,
        body: `${TAG} Confirmation # SCC-77182`,
      },
      {
        tripId: kerala.id,
        leadId: keralaLead.id,
        type: "TRIP_STARTED",
        title: "Trip started",
        body: `${TAG}`,
      },
      {
        tripId: bali.id,
        leadId: baliLead.id,
        vendorId: driver.id,
        type: "VENDOR_PAYMENT_ADDED",
        title: "Paid Suresh Nair · ₹46,000",
        body: `${TAG}`,
      },
    ],
  });

  console.log("\n  ✓ Seed complete. Data spread across the dashboard:\n");
  console.log("    Departures today              → Bali (Aanya & Rohan)");
  console.log("    In progress                   → Kerala (Mehta family)");
  console.log("    Awaiting vendor confirmation  → Tugu Bali (PENDING) + Suresh (REQUESTED, Bali)");
  console.log("    Overdue ops tasks             → Passport copies (Bali)");
  console.log("    Outstanding vendor balances   → Tugu (₹56,000) + Spice Coast (₹60,000)");
  console.log("    Recent operational activity   → 3 entries\n");
  console.log("  Open http://localhost:3000/operations to see it.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
