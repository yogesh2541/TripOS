import Link from "next/link";
import { Plus, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AssignmentCard } from "@/components/operations/assignment-card";
import { AssignmentFormDialog } from "@/components/operations/assignment-form-dialog";
import {
  VENDOR_ASSIGNMENT_CATEGORY_LABEL,
  VENDOR_ASSIGNMENT_CATEGORY_ORDER,
} from "@/lib/crm";
import type {
  AssignmentRow,
  VendorOption,
} from "@/server/services/operations";

export function VendorAssignmentBoard({
  tripId,
  assignments,
  vendors,
}: {
  tripId: string;
  assignments: AssignmentRow[];
  vendors: VendorOption[];
}) {
  if (assignments.length === 0) {
    return (
      <BoardEmpty
        tripId={tripId}
        vendors={vendors}
        hasVendors={vendors.length > 0}
      />
    );
  }

  // group by category, in our preferred order
  const groups = VENDOR_ASSIGNMENT_CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: assignments.filter((a) => a.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.category}>
          <header className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg text-navy">
                {VENDOR_ASSIGNMENT_CATEGORY_LABEL[g.category]}
              </h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {g.items.length}
              </span>
            </div>
          </header>
          <div className="grid gap-3 lg:grid-cols-2">
            {g.items.map((a) => (
              <AssignmentCard
                key={a.id}
                tripId={tripId}
                assignment={a}
                vendors={vendors}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BoardEmpty({
  tripId,
  vendors,
  hasVendors,
}: {
  tripId: string;
  vendors: VendorOption[];
  hasVendors: boolean;
}) {
  return (
    <EmptyState
      icon={<Handshake className="h-5 w-5" />}
      title="No vendor assignments yet"
      body="Once the booking is confirmed, assign hotels, transport, drivers and guides here. Each assignment becomes a confirmation to track and a voucher to send."
      action={
        hasVendors ? (
          <AssignmentFormDialog tripId={tripId} vendors={vendors} />
        ) : (
          <Link href="/vendors">
            <Button>
              <Plus className="h-4 w-4" />
              Add a vendor first
            </Button>
          </Link>
        )
      }
      hint="Pro tip: a confirmed assignment unlocks PDF voucher generation"
    />
  );
}
