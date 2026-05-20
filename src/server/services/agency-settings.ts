import "server-only";
import type { AgencySettings, Prisma } from "@prisma/client";
import { prisma, getOrCreateDemoUser } from "@/lib/prisma";

const DEFAULTS: Omit<Prisma.AgencySettingsCreateWithoutUserInput, "legalName"> = {
  invoicePrefix: "TC",
  defaultTaxScheme: "GST_5_NO_ITC",
  defaultTaxableBasis: "FULL_AMOUNT",
  defaultSacCode: "998552",
  country: "India",
  eInvoiceEnabled: false,
  eWayBillEnabled: false,
};

/**
 * Returns the current user's AgencySettings. If none exists yet, returns null
 * so callers can show a setup prompt (we do NOT auto-seed an empty record —
 * the legalName + GSTIN fields require the user's input to be meaningful).
 */
export async function getAgencySettings(): Promise<AgencySettings | null> {
  const user = await getOrCreateDemoUser();
  return prisma.agencySettings.findUnique({
    where: { userId: user.id },
  });
}

export async function upsertAgencySettings(
  patch: Prisma.AgencySettingsUpdateInput & { legalName?: string }
): Promise<AgencySettings> {
  const user = await getOrCreateDemoUser();
  const legalNameRaw =
    typeof patch.legalName === "string"
      ? patch.legalName
      : (patch.legalName as { set?: string } | undefined)?.set ?? "";
  const legalName = legalNameRaw.trim();
  if (legalName.length === 0) {
    throw new Error("Legal business name is required");
  }

  // Build the create payload from `patch` minus the keys we set explicitly,
  // layered on top of DEFAULTS.
  const { legalName: _legalNameOmit, user: _userOmit, ...rest } =
    patch as Prisma.AgencySettingsUpdateInput & {
      legalName?: unknown;
      user?: unknown;
    };
  void _legalNameOmit;
  void _userOmit;

  const createPayload: Prisma.AgencySettingsCreateInput = {
    ...DEFAULTS,
    ...(rest as Prisma.AgencySettingsCreateInput),
    legalName,
    user: { connect: { id: user.id } },
  };

  return prisma.agencySettings.upsert({
    where: { userId: user.id },
    create: createPayload,
    update: patch,
  });
}
