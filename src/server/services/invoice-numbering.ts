import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fiscalYearFor, formatInvoiceNumber } from "@/lib/gst";

/**
 * Allocates the next sequential invoice number for the given user + FY.
 *
 * Atomic via a `findUnique → update` inside the caller's transaction. Callers
 * MUST pass a transaction client to ensure the increment + the invoice update
 * commit together — a partial failure leaves a hole in the sequence which
 * Indian GST law explicitly disallows.
 */
export async function allocateNextInvoiceNumber(
  tx: Prisma.TransactionClient,
  opts: {
    userId: string;
    prefix: string;
    issueDate: Date;
  }
): Promise<{
  fiscalYear: string;
  sequence: number;
  invoiceNumber: string;
}> {
  const fiscalYear = fiscalYearFor(opts.issueDate);

  // Atomic upsert: create-or-bump in one statement so concurrent issues
  // can't read the same lastSequence.
  const counter = await tx.invoiceCounter.upsert({
    where: {
      userId_fiscalYear: { userId: opts.userId, fiscalYear },
    },
    update: {
      lastSequence: { increment: 1 },
    },
    create: {
      userId: opts.userId,
      fiscalYear,
      prefix: opts.prefix,
      lastSequence: 1,
    },
  });

  const invoiceNumber = formatInvoiceNumber({
    prefix: opts.prefix,
    fiscalYear,
    sequence: counter.lastSequence,
  });

  return {
    fiscalYear,
    sequence: counter.lastSequence,
    invoiceNumber,
  };
}

/**
 * Read-only preview of what the next invoice number would be.
 * NOT atomic — for display only. Use allocateNextInvoiceNumber when issuing.
 */
export async function previewNextInvoiceNumber(
  userId: string,
  prefix: string,
  issueDate: Date = new Date()
): Promise<string> {
  const fiscalYear = fiscalYearFor(issueDate);
  const existing = await prisma.invoiceCounter.findUnique({
    where: { userId_fiscalYear: { userId, fiscalYear } },
  });
  const nextSeq = (existing?.lastSequence ?? 0) + 1;
  return formatInvoiceNumber({ prefix, fiscalYear, sequence: nextSeq });
}
