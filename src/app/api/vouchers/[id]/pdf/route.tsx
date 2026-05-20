import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { VoucherDocument } from "@/components/vouchers/voucher-document";
import {
  publicShareUrl,
  type VoucherSnapshot,
} from "@/server/services/vouchers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const voucher = await prisma.voucher.findUnique({
    where: { id: params.id },
  });
  if (!voucher) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const snapshot = voucher.content as unknown as VoucherSnapshot;

  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(publicShareUrl(voucher.shareToken), {
      margin: 1,
      width: 220,
      color: { dark: "#0B1C2C", light: "#FFFFFF" },
    });
  } catch {
    qrDataUrl = null;
  }

  const buffer = await renderToBuffer(
    <VoucherDocument snapshot={snapshot} qrDataUrl={qrDataUrl} />
  );

  // Increment download counter (fire-and-forget)
  prisma.voucher
    .update({
      where: { id: voucher.id },
      data: { downloadCount: { increment: 1 } },
    })
    .catch(() => {});

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${voucher.voucherNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
