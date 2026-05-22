"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
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
  createLeadAction,
  type CreateLeadInput,
} from "@/server/actions/contacts";
import { LEAD_SOURCE_LABEL } from "@/lib/crm";

const SOURCES: CreateLeadInput["source"][] = [
  "MANUAL",
  "INSTAGRAM",
  "WHATSAPP",
  "REFERRAL",
  "WEBSITE",
  "GOOGLE",
  "OTHER",
];

export function NewLeadDialog({ trigger }: { trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<CreateLeadInput>({
    name: "",
    phone: "",
    email: "",
    source: "MANUAL",
    destination: "",
    travelStartDate: null,
    travelEndDate: null,
    adults: 2,
    budget: null,
    notes: null,
    gstin: "",
  });

  function update<K extends keyof CreateLeadInput>(
    key: K,
    value: CreateLeadInput[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    startTransition(async () => {
      try {
        const { id } = await createLeadAction(form);
        toast.success("Contact added");
        setOpen(false);
        router.push(`/contacts/${id}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Couldn't create contact";
        toast.error(msg);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" />
            New contact
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New contact</DialogTitle>
          <DialogDescription>
            Capture the essentials — you can fill in the rest later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="contact-name">Name</Label>
            <Input
              id="contact-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-phone">Phone (WhatsApp)</Label>
            <Input
              id="contact-phone"
              value={form.phone ?? ""}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+91 …"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select
              value={form.source}
              onValueChange={(v) =>
                update("source", v as CreateLeadInput["source"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_SOURCE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-dest">Destination interest</Label>
            <Input
              id="contact-dest"
              value={form.destination ?? ""}
              onChange={(e) => update("destination", e.target.value)}
              placeholder="e.g. Bali, Andamans"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-start">Travel from</Label>
            <Input
              id="contact-start"
              type="date"
              value={form.travelStartDate ?? ""}
              onChange={(e) =>
                update("travelStartDate", e.target.value || null)
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-end">Travel to</Label>
            <Input
              id="contact-end"
              type="date"
              value={form.travelEndDate ?? ""}
              onChange={(e) =>
                update("travelEndDate", e.target.value || null)
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-adults">Adults</Label>
            <Input
              id="contact-adults"
              type="number"
              min={1}
              max={40}
              value={form.adults}
              onChange={(e) => update("adults", Number(e.target.value || 1))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-budget">Budget (₹)</Label>
            <Input
              id="contact-budget"
              type="number"
              min={0}
              value={form.budget ?? ""}
              onChange={(e) =>
                update(
                  "budget",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-gstin">
              GSTIN
              <span className="ml-1 text-[10px] text-muted-foreground">
                (for B2B invoices)
              </span>
            </Label>
            <Input
              id="contact-gstin"
              value={form.gstin ?? ""}
              onChange={(e) => update("gstin", e.target.value.toUpperCase())}
              maxLength={15}
              placeholder="27AAACT1234A1ZS"
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="contact-notes">Notes</Label>
            <Textarea
              id="contact-notes"
              rows={3}
              value={form.notes ?? ""}
              onChange={(e) => update("notes", e.target.value || null)}
            />
          </div>
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
            Save contact
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
