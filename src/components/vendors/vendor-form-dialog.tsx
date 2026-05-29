"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pencil } from "lucide-react";
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
  createVendorAction,
  updateVendorAction,
  type VendorFormInput,
} from "@/server/actions/vendors";
import { VENDOR_TYPE_LABEL, VENDOR_TYPE_ORDER } from "@/lib/crm";

type VendorPatch = Partial<VendorFormInput> & { id?: string };

const EMPTY: VendorFormInput = {
  name: "",
  type: "HOTEL",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  gstNumber: "",
  paymentTerms: "",
  notes: "",
  isPreferred: false,
  isActive: true,
};

export function VendorFormDialog({
  trigger,
  vendor,
  mode = "create",
}: {
  trigger?: React.ReactNode;
  vendor?: VendorPatch;
  mode?: "create" | "edit";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<VendorFormInput>(() => ({
    ...EMPTY,
    ...(vendor ?? {}),
    name: vendor?.name ?? "",
    type: vendor?.type ?? "HOTEL",
  }));

  function update<K extends keyof VendorFormInput>(
    key: K,
    value: VendorFormInput[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    startTransition(async () => {
      try {
        if (mode === "edit" && vendor?.id) {
          await updateVendorAction(vendor.id, form);
          toast.success("Vendor updated");
          setOpen(false);
          router.refresh();
        } else {
          const { id } = await createVendorAction(form);
          toast.success("Vendor added");
          setOpen(false);
          router.push(`/vendors/${id}`);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save vendor");
      }
    });
  }

  const defaultTrigger =
    mode === "edit" ? (
      <Button variant="outline" size="sm">
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
    ) : (
      <Button>
        <Plus className="h-4 w-4" />
        New vendor
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit vendor" : "New vendor"}
          </DialogTitle>
          <DialogDescription>
            Suppliers, hotels, drivers, guides — anyone you book on behalf of a
            traveler.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="vendor-name">Name</Label>
            <Input
              id="vendor-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              autoFocus
              placeholder="e.g. Taj Lake Palace"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => update("type", v as VendorFormInput["type"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VENDOR_TYPE_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>
                    {VENDOR_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vendor-phone">Phone</Label>
            <Input
              id="vendor-phone"
              value={form.phone ?? ""}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+91 …"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vendor-whatsapp">WhatsApp</Label>
            <Input
              id="vendor-whatsapp"
              value={form.whatsapp ?? ""}
              onChange={(e) => update("whatsapp", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vendor-email">Email</Label>
            <Input
              id="vendor-email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="vendor-address">Address</Label>
            <Input
              id="vendor-address"
              value={form.address ?? ""}
              onChange={(e) => update("address", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vendor-city">City</Label>
            <Input
              id="vendor-city"
              value={form.city ?? ""}
              onChange={(e) => update("city", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-state">State</Label>
            <Input
              id="vendor-state"
              value={form.state ?? ""}
              onChange={(e) => update("state", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-country">Country</Label>
            <Input
              id="vendor-country"
              value={form.country ?? ""}
              onChange={(e) => update("country", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-gst">GSTIN</Label>
            <Input
              id="vendor-gst"
              value={form.gstNumber ?? ""}
              onChange={(e) => update("gstNumber", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="vendor-pay-terms">Payment terms</Label>
            <Input
              id="vendor-pay-terms"
              value={form.paymentTerms ?? ""}
              onChange={(e) => update("paymentTerms", e.target.value)}
              placeholder="e.g. 30% on booking, 70% before check-in"
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="vendor-notes">Notes</Label>
            <Textarea
              id="vendor-notes"
              rows={3}
              value={form.notes ?? ""}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Reliable, prefers WhatsApp, late check-in OK…"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPreferred ?? false}
              onChange={(e) => update("isPreferred", e.target.checked)}
              className="h-4 w-4 accent-[var(--gold-line)]"
            />
            Mark as preferred
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive ?? true}
              onChange={(e) => update("isActive", e.target.checked)}
              className="h-4 w-4 accent-[var(--gold-line)]"
            />
            Active vendor
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
            disabled={isPending || form.name.trim().length === 0}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "edit" ? "Save changes" : "Save vendor"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
