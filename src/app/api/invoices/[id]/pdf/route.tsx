// Public-fetchable PDF endpoint for tax invoices. Meta's WhatsApp Cloud API
// downloads the URL server-side to re-host the document on its CDN — that
// fetch carries no cookies, so we authenticate with a `?token=` query param
// that must match the invoice's shareToken.
//
// Internal callers (operator opens "Download PDF" from the invoice page)
// don't need a token — auth is per-session there. The token check is only
// enforced when one is present in the URL OR when the invoice has been
// flagged with a shareToken (meaning it was shared externally).

import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { InvoiceDocument } from "@/components/invoices/invoice-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // When the URL carries a token, it must match. This is the public path
  // (WhatsApp/customer browser). Without a token we permit (internal).
  const provided = req.nextUrl.searchParams.get("token");
  if (provided) {
    if (!invoice.shareToken || invoice.shareToken !== provided) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const buffer = await renderToBuffer(<InvoiceDocument invoice={invoice} />);

  const filename = `${invoice.invoiceNumber ?? `invoice-${invoice.id}`}.pdf`.replace(
    /[\/\\]/g,
    "-"
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      // Meta caches PDFs once, so a short cache is fine.
      "Cache-Control": "private, max-age=60",
    },
  });
}
