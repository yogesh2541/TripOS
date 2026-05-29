import { OperationsHeader } from "@/components/operations/operations-header";
import { VendorAssignmentBoard } from "@/components/operations/vendor-assignment-board";
import { AssignmentFormDialog } from "@/components/operations/assignment-form-dialog";
import { OperationsChecklist } from "@/components/operations/operations-checklist";
import { OperationsTimeline } from "@/components/operations/operations-timeline";
import { getTripOperations } from "@/server/services/operations";

export async function OperationsPanel({ tripId }: { tripId: string }) {
  const snapshot = await getTripOperations(tripId);
  if (!snapshot) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-paper-2 p-8 text-center text-sm text-muted">
        Trip not found.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <OperationsHeader snapshot={snapshot} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink">
            Vendor assignments
          </h2>
          <p className="text-sm text-muted">
            Suppliers booked for this trip, grouped by service.
          </p>
        </div>
        {snapshot.assignments.length > 0 ? (
          <AssignmentFormDialog
            tripId={tripId}
            vendors={snapshot.vendorPickerOptions}
          />
        ) : null}
      </div>

      <VendorAssignmentBoard
        tripId={tripId}
        assignments={snapshot.assignments}
        vendors={snapshot.vendorPickerOptions}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <OperationsChecklist tripId={tripId} items={snapshot.checklist} />
        <OperationsTimeline entries={snapshot.timeline} />
      </div>
    </div>
  );
}
