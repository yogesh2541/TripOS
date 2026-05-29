"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Trash2,
  Star,
  CalendarRange,
  Tag,
  Eye,
  EyeOff,
  Hash,
  Phone,
  MessageCircle,
  Mail,
  CheckCheck,
  FileText,
  Send,
  Copy,
  RefreshCw,
  Download,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AssignmentFormDialog,
  type AssignmentEditableValues,
} from "@/components/operations/assignment-form-dialog";
import {
  transitionVendorAssignmentAction,
  deleteVendorAssignmentAction,
  restoreVendorAssignmentAction,
} from "@/server/actions/vendor-assignments";
import {
  generateVoucherAction,
  markVoucherSentAction,
  regenerateVoucherAction,
  deleteVoucherAction,
  restoreVoucherAction,
} from "@/server/actions/vouchers";
import {
  VENDOR_ASSIGNMENT_STATUS_LABEL,
  VENDOR_ASSIGNMENT_STATUS_TONE,
} from "@/lib/crm";
import { cn, formatDate, formatINR } from "@/lib/utils";
import type {
  AssignmentRow,
  VendorOption,
} from "@/server/services/operations";

export function AssignmentCard({
  tripId,
  assignment,
  vendors,
}: {
  tripId: string;
  assignment: AssignmentRow;
  vendors: VendorOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmationNumber, setConfirmationNumber] = useState(
    assignment.confirmationNumber ?? ""
  );

  function transition(
    status: "REQUESTED" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "PENDING",
    extras?: { confirmationNumber?: string | null }
  ) {
    startTransition(async () => {
      try {
        await transitionVendorAssignmentAction({
          assignmentId: assignment.id,
          status,
          confirmationNumber: extras?.confirmationNumber,
        });
        toast.success(`Marked ${status.toLowerCase()}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't update");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        const r = await deleteVendorAssignmentAction(assignment.id);
        const snap = r.snapshot;
        toast.success(`Removed ${assignment.vendor?.name ?? assignment.title}`, {
          description: assignment.title,
          duration: 6000,
          action: {
            label: "Undo",
            onClick: () => {
              startTransition(async () => {
                try {
                  await restoreVendorAssignmentAction(snap);
                  toast.success("Assignment restored");
                  router.refresh();
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Couldn't restore"
                  );
                }
              });
            },
          },
        });
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't delete");
      }
    });
  }

  function confirmWithNumber() {
    transition("CONFIRMED", {
      confirmationNumber: confirmationNumber.trim() || null,
    });
    setConfirmOpen(false);
  }

  function generateVoucher() {
    startTransition(async () => {
      try {
        const r = await generateVoucherAction(assignment.id);
        toast.success(`Voucher ${r.voucherNumber} generated`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't generate");
      }
    });
  }

  function markVoucherSent(voucherId: string) {
    startTransition(async () => {
      try {
        await markVoucherSentAction({ voucherId });
        toast.success("Marked sent");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't mark sent");
      }
    });
  }

  function regenerate(voucherId: string) {
    startTransition(async () => {
      try {
        await regenerateVoucherAction(voucherId);
        toast.success("Voucher refreshed");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't refresh");
      }
    });
  }

  function removeVoucher(voucherId: string, voucherNumber: string) {
    startTransition(async () => {
      try {
        const r = await deleteVoucherAction(voucherId);
        const snap = r.snapshot;
        toast.success(`Voucher ${voucherNumber} deleted`, {
          description: "Share link is invalid until restored.",
          duration: 6000,
          action: {
            label: "Undo",
            onClick: () => {
              startTransition(async () => {
                try {
                  await restoreVoucherAction(snap);
                  toast.success("Voucher restored");
                  router.refresh();
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Couldn't restore"
                  );
                }
              });
            },
          },
        });
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't delete voucher");
      }
    });
  }

  async function copyShareLink(token: string) {
    const url = `${window.location.origin}/v/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.error("Couldn't copy — copy manually: " + url);
    }
  }

  const latestVoucher = assignment.vouchers[0] ?? null;

  const editableValues: AssignmentEditableValues = {
    id: assignment.id,
    vendorId: assignment.vendor?.id ?? null,
    category: assignment.category,
    title: assignment.title,
    description: assignment.description ?? "",
    startDate: assignment.startDate
      ? assignment.startDate.toISOString().slice(0, 10)
      : null,
    endDate: assignment.endDate
      ? assignment.endDate.toISOString().slice(0, 10)
      : null,
    quantity: assignment.quantity,
    totalCost: assignment.totalCost,
    sellingPrice: assignment.sellingPrice,
    confirmationNumber: assignment.confirmationNumber ?? "",
    notes: assignment.notes ?? "",
    customerVisible: assignment.customerVisible,
  };

  const isCancelled = assignment.status === "CANCELLED";
  const isConfirmed =
    assignment.status === "CONFIRMED" || assignment.status === "COMPLETED";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group rounded-lg border bg-paper p-4 shadow-soft transition-all",
        isConfirmed && "border-ok/30",
        isCancelled && "border-bad/30 opacity-70",
        !isConfirmed && !isCancelled && "border-line"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {assignment.vendor ? (
              <>
                <Link
                  href={`/vendors/${assignment.vendor.id}`}
                  className="font-medium text-ink hover:text-gold-deep truncate"
                >
                  {assignment.vendor.name}
                </Link>
                {assignment.vendor.isPreferred ? (
                  <Star className="h-3 w-3 fill-gold-deep text-gold-deep shrink-0" />
                ) : null}
              </>
            ) : (
              // Draft seeded from a quote — vendor not yet assigned.
              <span className="inline-flex items-center gap-1.5 text-warn">
                <Star className="h-3 w-3 fill-warn text-warn shrink-0" />
                <span className="font-medium">Vendor not assigned</span>
              </span>
            )}
          </div>
          <p className="text-sm text-ink/80 truncate">{assignment.title}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant={VENDOR_ASSIGNMENT_STATUS_TONE[assignment.status]}>
            {VENDOR_ASSIGNMENT_STATUS_LABEL[assignment.status]}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <AssignmentFormDialog
                tripId={tripId}
                vendors={vendors}
                mode="edit"
                assignment={editableValues}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    Edit details
                  </DropdownMenuItem>
                }
              />
              <DropdownMenuSeparator />
              {assignment.status === "PENDING" ? (
                <DropdownMenuItem onSelect={() => transition("REQUESTED")}>
                  Mark requested
                </DropdownMenuItem>
              ) : null}
              {!isConfirmed && !isCancelled ? (
                <DropdownMenuItem onSelect={() => setConfirmOpen(true)}>
                  <CheckCircle2 className="h-3.5 w-3.5 text-ok" />
                  Confirm…
                </DropdownMenuItem>
              ) : null}
              {assignment.status === "CONFIRMED" ? (
                <DropdownMenuItem onSelect={() => transition("COMPLETED")}>
                  <CheckCheck className="h-3.5 w-3.5 text-ok" />
                  Mark completed
                </DropdownMenuItem>
              ) : null}
              {isConfirmed ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Voucher</DropdownMenuLabel>
                  {latestVoucher ? (
                    <>
                      <DropdownMenuItem
                        onSelect={() =>
                          window.open(
                            `/api/vouchers/${latestVoucher.id}/pdf`,
                            "_blank"
                          )
                        }
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          window.open(`/v/${latestVoucher.shareToken}`, "_blank")
                        }
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open share page
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          copyShareLink(latestVoucher.shareToken)
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy share link
                      </DropdownMenuItem>
                      {!latestVoucher.sentAt ? (
                        <DropdownMenuItem
                          onSelect={() => markVoucherSent(latestVoucher.id)}
                        >
                          <Send className="h-3.5 w-3.5 text-gold-deep" />
                          Mark sent
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        onSelect={() => regenerate(latestVoucher.id)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh snapshot
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          removeVoucher(
                            latestVoucher.id,
                            latestVoucher.voucherNumber
                          )
                        }
                        className="text-bad focus:bg-bad-soft"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete voucher
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem onSelect={generateVoucher}>
                      <FileText className="h-3.5 w-3.5 text-gold-deep" />
                      Generate voucher
                    </DropdownMenuItem>
                  )}
                </>
              ) : null}
              {!isCancelled ? (
                <DropdownMenuItem onSelect={() => transition("CANCELLED")}>
                  <XCircle className="h-3.5 w-3.5 text-bad" />
                  Cancel
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => transition("PENDING")}>
                  Reopen
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={remove}
                className="text-bad focus:bg-bad-soft"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {assignment.startDate ? (
          <span className="inline-flex items-center gap-1">
            <CalendarRange className="h-3 w-3" />
            {formatDate(assignment.startDate)}
            {assignment.endDate
              ? ` → ${formatDate(assignment.endDate)}`
              : ""}
          </span>
        ) : null}
        {assignment.confirmationNumber ? (
          <span className="inline-flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {assignment.confirmationNumber}
          </span>
        ) : null}
        {assignment.totalCost !== null ? (
          <span className="inline-flex items-center gap-1 text-ink font-mono tabular-nums">
            <Tag className="h-3 w-3" />
            {formatINR(assignment.totalCost)}
            {assignment.sellingPrice !== null
              ? ` / ${formatINR(assignment.sellingPrice)}`
              : ""}
          </span>
        ) : null}
        <span
          className="inline-flex items-center gap-1"
          title={
            assignment.customerVisible
              ? "Visible to traveler"
              : "Internal only"
          }
        >
          {assignment.customerVisible ? (
            <Eye className="h-3 w-3" />
          ) : (
            <EyeOff className="h-3 w-3" />
          )}
        </span>
      </div>

      {assignment.vendor ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {assignment.vendor.phone ? (
            <a
              href={`tel:${assignment.vendor.phone}`}
              className="inline-flex items-center gap-1 rounded-[6px] border border-line bg-paper px-2 py-0.5 text-[11px] text-ink hover:border-[var(--gold-line)]"
            >
              <Phone className="h-3 w-3" />
              Call
            </a>
          ) : null}
          {assignment.vendor.whatsapp ? (
            <a
              href={`https://wa.me/${assignment.vendor.whatsapp.replace(
                /\D/g,
                ""
              )}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-[6px] border border-line bg-paper px-2 py-0.5 text-[11px] text-ok hover:border-ok/40"
            >
              <MessageCircle className="h-3 w-3" />
              WhatsApp
            </a>
          ) : null}
          {assignment.vendor.email ? (
            <a
              href={`mailto:${assignment.vendor.email}`}
              className="inline-flex items-center gap-1 rounded-[6px] border border-line bg-paper px-2 py-0.5 text-[11px] text-ink hover:border-[var(--gold-line)]"
            >
              <Mail className="h-3 w-3" />
              Email
            </a>
          ) : null}
        </div>
      ) : null}

      {latestVoucher ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-[8px] border border-[var(--gold-line)] bg-gold-soft/40 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-3.5 w-3.5 text-gold-deep shrink-0" />
            <span className="text-xs font-medium text-ink font-mono tabular-nums truncate">
              {latestVoucher.voucherNumber}
            </span>
            {latestVoucher.sentAt ? (
              <Badge variant="success">Sent</Badge>
            ) : (
              <Badge variant="muted">Draft</Badge>
            )}
            {latestVoucher.downloadCount > 0 ? (
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {latestVoucher.downloadCount} dl
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={`/api/vouchers/${latestVoucher.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-ink hover:bg-paper"
              title="Download PDF"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
            <a
              href={`/v/${latestVoucher.shareToken}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-ink hover:bg-paper"
              title="Open share page"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={() => copyShareLink(latestVoucher.shareToken)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-ink hover:bg-paper"
              title="Copy share link"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {assignment.vendor?.name ?? "Vendor"} · {assignment.title}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="conf-num">Confirmation #</Label>
              <Input
                id="conf-num"
                autoFocus
                value={confirmationNumber}
                onChange={(e) => setConfirmationNumber(e.target.value)}
                placeholder="e.g. TAJ-241208"
              />
              <p className="text-[11px] text-muted-foreground">
                Leave blank if you don't have one yet — you can always add it
                later.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={confirmWithNumber}>
                <CheckCircle2 className="h-4 w-4" />
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
