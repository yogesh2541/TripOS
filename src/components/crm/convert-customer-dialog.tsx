"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { convertLeadToCustomerAction } from "@/server/actions/customers";

export function ConvertCustomerDialog({ contactId }: { contactId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [dietary, setDietary] = useState("");
  const [hotels, setHotels] = useState("");
  const [travelStyle, setTravelStyle] = useState("");
  const [other, setOther] = useState("");

  function submit() {
    startTransition(async () => {
      try {
        await convertLeadToCustomerAction({
          contactId,
          preferences: {
            dietary: dietary || null,
            hotels: hotels || null,
            travelStyle: travelStyle || null,
            other: other || null,
          },
        });
        toast.success("Converted to customer");
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't convert");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent" size="sm">
          <UserPlus className="h-3.5 w-3.5" />
          Convert to customer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to customer</DialogTitle>
          <DialogDescription>
            Optional: capture a few preferences so future trips feel personal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pref-dietary">Dietary</Label>
            <Input
              id="pref-dietary"
              placeholder="Vegetarian, no shellfish…"
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pref-hotels">Hotel preferences</Label>
            <Input
              id="pref-hotels"
              placeholder="Boutique stays, sea view, quiet locations…"
              value={hotels}
              onChange={(e) => setHotels(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pref-style">Travel style</Label>
            <Input
              id="pref-style"
              placeholder="Slow & immersive, off-beat, photography focused…"
              value={travelStyle}
              onChange={(e) => setTravelStyle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pref-other">Other notes</Label>
            <Textarea
              id="pref-other"
              rows={3}
              placeholder="Anniversary in March, prefers WhatsApp over email, etc."
              value={other}
              onChange={(e) => setOther(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
