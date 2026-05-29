"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  createOperationTaskAction,
  deleteOperationTaskAction,
  restoreOperationTaskAction,
  toggleOperationTaskAction,
  type OperationTaskInput,
} from "@/server/actions/operation-tasks";
import {
  OPERATION_TASK_PRIORITY_LABEL,
  OPERATION_TASK_PRIORITY_TONE,
  OPERATION_TASK_TYPE_LABEL,
} from "@/lib/crm";
import { cn, formatDate } from "@/lib/utils";
import type { ChecklistItem } from "@/server/services/operations";

export function OperationsChecklist({
  tripId,
  items,
}: {
  tripId: string;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimistic, addOptimistic] = useOptimistic(
    items,
    (curr, m: { id: string; status: "COMPLETED" | "PENDING" }) =>
      curr.map((i) =>
        i.id === m.id
          ? {
              ...i,
              status: m.status,
              completedAt: m.status === "COMPLETED" ? new Date() : null,
            }
          : i
      )
  );

  const completedCount = optimistic.filter(
    (i) => i.status === "COMPLETED"
  ).length;
  const pct =
    optimistic.length === 0
      ? 0
      : Math.round((completedCount / optimistic.length) * 100);

  function toggle(item: ChecklistItem) {
    const next: "COMPLETED" | "PENDING" =
      item.status === "COMPLETED" ? "PENDING" : "COMPLETED";
    startTransition(async () => {
      addOptimistic({ id: item.id, status: next });
      try {
        await toggleOperationTaskAction(item.id, next === "COMPLETED");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't update task");
        router.refresh();
      }
    });
  }

  function remove(item: ChecklistItem) {
    startTransition(async () => {
      try {
        const r = await deleteOperationTaskAction(item.id);
        const snap = r.snapshot;
        toast.success(`Removed "${item.title}"`, {
          duration: 6000,
          action: {
            label: "Undo",
            onClick: () => {
              startTransition(async () => {
                try {
                  await restoreOperationTaskAction(snap);
                  toast.success("Task restored");
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

  return (
    <section className="rounded-lg border border-line bg-paper p-5 shadow-soft space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-xl text-ink">
              Operations checklist
            </h3>
            <Badge variant="muted">
              {completedCount}/{optimistic.length}
            </Badge>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Auto-seeded on first vendor assignment. Add custom items as needed.
          </p>
        </div>
        <NewTaskDialog tripId={tripId} />
      </header>

      <div className="h-1.5 w-full rounded-full bg-line/80 overflow-hidden">
        <div
          className="h-full bg-ok transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {optimistic.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-line/70 bg-paper-2 p-6 text-center">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper text-gold-deep">
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="text-sm font-medium text-ink">
            Checklist seeds itself
          </p>
          <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
            Assign your first vendor and we'll auto-add 5 standard ops tasks
            (hotel confirms, balance collection, vouchers, documents).
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {optimistic.map((item) => (
              <ChecklistRow
                key={item.id}
                item={item}
                onToggle={() => toggle(item)}
                onRemove={() => remove(item)}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function ChecklistRow({
  item,
  onToggle,
  onRemove,
}: {
  item: ChecklistItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const isDone = item.status === "COMPLETED";
  const overdue =
    !isDone && item.dueDate && item.dueDate.getTime() < Date.now();

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "group flex items-center gap-3 rounded-[10px] border p-3 transition-colors",
        isDone
          ? "border-ok/30 bg-ok-soft/40"
          : "border-line bg-paper hover:border-[var(--gold-line)]"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all shrink-0",
          isDone
            ? "border-ok bg-ok text-[var(--on-dark)]"
            : "border-line hover:border-[var(--gold-line)] text-transparent hover:text-gold-deep"
        )}
        aria-label={isDone ? "Mark incomplete" : "Mark complete"}
      >
        <Check className="h-3.5 w-3.5" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "text-sm font-medium",
              isDone
                ? "text-muted line-through"
                : "text-ink"
            )}
          >
            {item.title}
          </span>
          {item.type !== "OTHER" && item.type !== "INTERNAL" ? (
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {OPERATION_TASK_TYPE_LABEL[item.type]}
            </span>
          ) : null}
          {item.priority !== "MEDIUM" ? (
            <Badge variant={OPERATION_TASK_PRIORITY_TONE[item.priority]}>
              {OPERATION_TASK_PRIORITY_LABEL[item.priority]}
            </Badge>
          ) : null}
          {overdue ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-bad">
              <AlertTriangle className="h-3 w-3" />
              Overdue
            </span>
          ) : null}
        </div>
        {item.description ? (
          <p
            className={cn(
              "text-xs mt-0.5",
              isDone ? "text-faint" : "text-muted"
            )}
          >
            {item.description}
          </p>
        ) : null}
        <div className="mt-1 flex items-center gap-3 text-[11px] text-faint font-mono tabular-nums">
          {item.dueDate ? <span>Due {formatDate(item.dueDate)}</span> : null}
          {item.completedAt ? (
            <span>Completed {formatDate(item.completedAt)}</span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-[6px] text-muted hover:text-bad hover:bg-bad-soft"
        aria-label="Remove task"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </motion.li>
  );
}

const TASK_TYPES = [
  "OTHER",
  "HOTEL_CONFIRMATION",
  "DRIVER_ASSIGNMENT",
  "PAYMENT_COLLECTION",
  "VOUCHER_SENT",
  "DOCUMENT_COLLECTION",
  "INTERNAL",
] as const;

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

function NewTaskDialog({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<OperationTaskInput>({
    tripId,
    title: "",
    description: "",
    type: "OTHER",
    priority: "MEDIUM",
    dueDate: null,
  });

  function update<K extends keyof OperationTaskInput>(
    key: K,
    v: OperationTaskInput[K]
  ) {
    setForm((f) => ({ ...f, [key]: v }));
  }

  function submit() {
    startTransition(async () => {
      try {
        await createOperationTaskAction(form);
        toast.success("Task added");
        setOpen(false);
        setForm({
          tripId,
          title: "",
          description: "",
          type: "OTHER",
          priority: "MEDIUM",
          dueDate: null,
        });
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save task");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add operations task</DialogTitle>
          <DialogDescription>
            Custom checklist item for this trip's operations.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ot-title">Title</Label>
            <Input
              id="ot-title"
              autoFocus
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Send WhatsApp reminder for visa copy"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ot-desc">Description</Label>
            <Input
              id="ot-desc"
              value={form.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>

          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  update("type", v as OperationTaskInput["type"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {OPERATION_TASK_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) =>
                  update("priority", v as OperationTaskInput["priority"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {OPERATION_TASK_PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ot-due">Due date</Label>
            <Input
              id="ot-due"
              type="date"
              value={form.dueDate ?? ""}
              onChange={(e) => update("dueDate", e.target.value || null)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isPending || form.title.trim().length === 0}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
