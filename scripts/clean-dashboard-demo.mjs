// Removes everything tagged [DEMO] by seed-dashboard-demo.mjs.
//
//   node scripts/clean-dashboard-demo.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TAG = "[DEMO]";

async function main() {
  // Trips first — cascades to assignments, ops tasks, vendor-payments tied to the trip
  const trips = await prisma.trip.deleteMany({
    where: { notes: { contains: TAG } },
  });
  // Activities tagged in body
  const acts = await prisma.activity.deleteMany({
    where: { body: { contains: TAG } },
  });
  // Vendor payments referencing demo notes (covers vendor payouts not deleted by trip cascade)
  const payments = await prisma.vendorPayment.deleteMany({
    where: { notes: { contains: TAG } },
  });
  // Vendors next (assignments are gone, restrict no longer trips us)
  const vendors = await prisma.vendor.deleteMany({
    where: { notes: { contains: TAG } },
  });
  // Demo leads
  const leads = await prisma.lead.deleteMany({
    where: { notes: { contains: TAG } },
  });

  console.log({
    trips: trips.count,
    leads: leads.count,
    vendors: vendors.count,
    activities: acts.count,
    vendorPayments: payments.count,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
