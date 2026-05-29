"use client";

import { useOptimistic, useTransition } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { LeadStatus } from "@prisma/client";
import { LeadCard, type LeadCardData } from "@/components/crm/contact-card";
import {
  LEAD_STATUS_COLUMN_DESC,
  LEAD_STATUS_LABEL,
  LEAD_STATUS_ORDER,
} from "@/lib/crm";
import { updateLeadStatusAction } from "@/server/actions/contacts";
import { cn } from "@/lib/utils";

export type KanbanLead = LeadCardData & { status: LeadStatus };

export function LeadKanban({ leads }: { leads: KanbanLead[] }) {
  const [optimisticLeads, applyOptimistic] = useOptimistic<
    KanbanLead[],
    { id: string; status: LeadStatus }
  >(leads, (current, change) =>
    current.map((l) => (l.id === change.id ? { ...l, status: change.status } : l))
  );

  const router = useRouter();
  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const contact = optimisticLeads.find((l) => l.id === id);
    if (!contact) return;

    const targetStatus = isStatusId(overId)
      ? overId
      : optimisticLeads.find((l) => l.id === overId)?.status;
    if (!targetStatus || targetStatus === contact.status) return;

    startTransition(async () => {
      applyOptimistic({ id, status: targetStatus });
      try {
        await updateLeadStatusAction(id, targetStatus);
        toast.success(`Moved to ${LEAD_STATUS_LABEL[targetStatus]}`);
        // Re-fetch the server component so the moved card keeps its new
        // column. Without this, useOptimistic reverts to the stale `leads`
        // prop when the transition ends and the card snaps back.
        router.refresh();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Couldn't update status";
        toast.error(msg);
      }
    });
  }

  const activeLead = activeId
    ? optimisticLeads.find((l) => l.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-4 overflow-x-auto pb-4">
        {LEAD_STATUS_ORDER.map((status) => {
          const items = optimisticLeads.filter((l) => l.status === status);
          return (
            <Column
              key={status}
              status={status}
              items={items}
              isOverlayTarget={activeLead?.status !== status}
            />
          );
        })}
      </div>
      <DragOverlay>
        {activeLead && <LeadCard contact={activeLead} />}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  items,
  isOverlayTarget,
}: {
  status: LeadStatus;
  items: KanbanLead[];
  isOverlayTarget: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-3 rounded-lg bg-paper-2 border border-line p-3 transition-colors",
        isOver && isOverlayTarget && "bg-gold-soft/50 border-[var(--gold-line)]"
      )}
    >
      <header className="px-2 pb-2 border-b border-line-2">
        <p className="font-display text-base text-ink">
          {LEAD_STATUS_LABEL[status]}
          <span className="ml-2 font-mono text-xs text-muted">
            {items.length}
          </span>
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted mt-0.5">
          {LEAD_STATUS_COLUMN_DESC[status]}
        </p>
      </header>
      <SortableContext
        items={items.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3 min-h-[120px]">
          {items.length === 0 && (
            <div className="rounded-[10px] border border-dashed border-line p-6 text-center text-xs text-muted-foreground">
              Empty
            </div>
          )}
          {items.map((contact) => (
            <LeadCard key={contact.id} contact={contact} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function isStatusId(id: string): id is LeadStatus {
  return (LEAD_STATUS_ORDER as readonly string[]).includes(id);
}
