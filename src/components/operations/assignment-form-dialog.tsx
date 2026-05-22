"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pencil, Star, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createVendorAssignmentAction,
  updateVendorAssignmentAction,
  type AssignmentFormInput,
} from "@/server/actions/vendor-assignments";
import {
  VENDOR_ASSIGNMENT_CATEGORY_LABEL,
  VENDOR_ASSIGNMENT_CATEGORY_ORDER,
  VENDOR_TYPE_LABEL,
} from "@/lib/crm";
import { calendarDayDiff, cn, formatINR } from "@/lib/utils";
import type { VendorOption } from "@/server/services/operations";

type DialogMode = "create" | "edit";

export type AssignmentEditableValues = Omit<
  AssignmentFormInput,
  "tripId"
> & { id?: string };

const EMPTY = (tripId: string): AssignmentFormInput => ({
  tripId,
  vendorId: "",
  category: "HOTEL",
  title: "",
  description: "",
  startDate: null,
  endDate: null,
  quantity: null,
  totalCost: null,
  sellingPrice: null,
  confirmationNumber: "",
  notes: "",
  customerVisible: true,
});

export function AssignmentFormDialog({
  tripId,
  vendors,
  trigger,
  mode = "create",
  assignment,
}: {
  tripId: string;
  vendors: VendorOption[];
  trigger?: React.ReactNode;
  mode?: DialogMode;
  assignment?: AssignmentEditableValues;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<AssignmentFormInput>(() => ({
    ...EMPTY(tripId),
    ...(assignment ? { ...assignment, tripId } : {}),
  }));
  const [vendorSearch, setVendorSearch] = useState("");

  const selectedVendor = vendors.find((v) => v.id === form.vendorId);

  // Nights are a fact of the dates — derive them rather than asking twice.
  const derivedNights = useMemo(() => {
    if (!form.startDate || !form.endDate) return null;
    const n = calendarDayDiff(form.startDate, form.endDate);
    return n > 0 ? n : null;
  }, [form.startDate, form.endDate]);

  const isHotelLike = form.category === "HOTEL";

  // Live margin so the operator sees profitability while typing.
  const margin = useMemo(() => {
    const { totalCost, sellingPrice } = form;
    if (totalCost == null || sellingPrice == null) return null;
    const amount = sellingPrice - totalCost;
    const pct =
      sellingPrice > 0 ? Math.round((amount / sellingPrice) * 100) : 0;
    return { amount, pct };
  }, [form.totalCost, form.sellingPrice]);

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.city ?? "").toLowerCase().includes(q)
    );
  }, [vendorSearch, vendors]);

  function update<K extends keyof AssignmentFormInput>(
    key: K,
    value: AssignmentFormInput[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    if (!form.vendorId) {
      toast.error("Pick a vendor");
      return;
    }
    if (form.title.trim().length === 0) {
      toast.error("Add a service title");
      return;
    }
    // Dates win over any manual quantity — keep them the single source.
    const payload: AssignmentFormInput = {
      ...form,
      quantity: derivedNights ?? form.quantity,
    };
    startTransition(async () => {
      try {
        if (mode === "edit" && assignment?.id) {
          await updateVendorAssignmentAction(assignment.id, payload);
          toast.success("Assignment updated");
        } else {
          await createVendorAssignmentAction(payload);
          toast.success("Vendor assigned");
        }
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  const defaultTrigger =
    mode === "edit" ? (
      <Button variant="outline" size="sm">
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
    ) : (
      <Button>
        <Plus className="h-4 w-4" />
        Assign vendor
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit assignment" : "Assign a vendor"}
          </DialogTitle>
          <DialogDescription>
            Capture the supplier service, dates, cost and selling price.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Vendor</Label>
            {selectedVendor ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-sand-200 bg-sand-50/50 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  {selectedVendor.isPreferred ? (
                    <Star className="h-3.5 w-3.5 fill-sand text-sand shrink-0" />
                  ) : null}
                  <div className="min-w-0">
                    <p className="font-medium text-navy truncate">
                      {selectedVendor.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {VENDOR_TYPE_LABEL[selectedVendor.type]}
                      {selectedVendor.city ? ` · ${selectedVendor.city}` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => update("vendorId", "")}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-line bg-white p-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    placeholder="Search vendors by name or city…"
                    className="pl-9"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg">
                  {filteredVendors.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                      No vendors match. Add one from /vendors first.
                    </p>
                  ) : (
                    <ul className="divide-y divide-line/70">
                      {filteredVendors.map((v) => (
                        <li key={v.id}>
                          <button
                            type="button"
                            onClick={() => update("vendorId", v.id)}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-ivory transition-colors"
                          >
                            {v.isPreferred ? (
                              <Star className="h-3.5 w-3.5 fill-sand text-sand shrink-0" />
                            ) : (
                              <span className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-navy truncate">
                                {v.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {VENDOR_TYPE_LABEL[v.type]}
                                {v.city ? ` · ${v.city}` : ""}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) =>
                update("category", v as AssignmentFormInput["category"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VENDOR_ASSIGNMENT_CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>
                    {VENDOR_ASSIGNMENT_CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-conf">Confirmation #</Label>
            <Input
              id="a-conf"
              value={form.confirmationNumber ?? ""}
              onChange={(e) => update("confirmationNumber", e.target.value)}
              placeholder="e.g. TAJ-241208"
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="a-title">Service title</Label>
            <Input
              id="a-title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. 3 nights — Lake View Suite, BB"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-start">Start</Label>
            <Input
              id="a-start"
              type="date"
              value={form.startDate ?? ""}
              onChange={(e) => update("startDate", e.target.value || null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-end">End</Label>
            <Input
              id="a-end"
              type="date"
              value={form.endDate ?? ""}
              onChange={(e) => update("endDate", e.target.value || null)}
            />
          </div>

          {/* Quantity — auto-derived as nights whenever both dates are set,
              so it never has to be entered twice. */}
          <div className="space-y-1.5">
            <Label htmlFor="a-qty">{isHotelLike ? "Nights" : "Quantity"}</Label>
            {derivedNights !== null ? (
              <div className="flex h-11 items-center gap-2 rounded-2xl border border-line bg-ivory px-4 text-sm">
                <span className="font-medium text-navy tabular-nums">
                  {derivedNights}
                </span>
                <span className="text-xs text-muted-foreground">
                  {isHotelLike
                    ? `night${derivedNights === 1 ? "" : "s"}`
                    : `day${derivedNights === 1 ? "" : "s"}`}{" "}
                  · auto from dates
                </span>
              </div>
            ) : (
              <Input
                id="a-qty"
                type="number"
                min={0}
                value={form.quantity ?? ""}
                onChange={(e) =>
                  update(
                    "quantity",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                placeholder={isHotelLike ? "Set the dates above" : "e.g. 2"}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-total">Cost (₹)</Label>
            <Input
              id="a-total"
              type="number"
              min={0}
              value={form.totalCost ?? ""}
              onChange={(e) =>
                update(
                  "totalCost",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              placeholder="What you owe the vendor"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-sell">Selling price (₹)</Label>
            <Input
              id="a-sell"
              type="number"
              min={0}
              value={form.sellingPrice ?? ""}
              onChange={(e) =>
                update(
                  "sellingPrice",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              placeholder="What the client pays"
            />
          </div>

          {/* Live margin — derived, never entered. */}
          <div className="space-y-1.5">
            <Label>Margin</Label>
            <div
              className={cn(
                "flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm",
                margin === null
                  ? "border-line bg-ivory text-muted-foreground"
                  : margin.amount >= 0
                    ? "border-emerald-200 bg-emerald-50/60 text-emerald-800"
                    : "border-red-200 bg-red-50/60 text-red-700"
              )}
            >
              {margin === null ? (
                <span className="text-xs">Enter cost &amp; selling price</span>
              ) : (
                <>
                  <span className="font-medium tabular-nums">
                    {formatINR(margin.amount)}
                  </span>
                  <span className="text-xs opacity-80">
                    {margin.pct}% margin
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="a-desc">Description (shown on voucher)</Label>
            <Textarea
              id="a-desc"
              rows={2}
              value={form.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Inclusions, room category, vehicle type…"
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="a-notes">Internal notes</Label>
            <Textarea
              id="a-notes"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Hidden from traveler — for your team"
            />
          </div>

          <label
            className={cn(
              "sm:col-span-2 flex items-center gap-2 text-sm rounded-xl border border-line p-3",
              form.customerVisible ? "bg-emerald-50/40" : "bg-ivory"
            )}
          >
            <input
              type="checkbox"
              checked={form.customerVisible ?? true}
              onChange={(e) => update("customerVisible", e.target.checked)}
              className="h-4 w-4 accent-sand-700"
            />
            <span>
              Show this on the traveler-facing proposal & voucher
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              isPending || !form.vendorId || form.title.trim().length === 0
            }
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "edit" ? "Save changes" : "Assign vendor"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
