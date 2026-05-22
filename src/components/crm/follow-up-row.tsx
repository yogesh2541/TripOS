"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  completeTaskAction,
  deleteTaskAction,
  snoozeTaskAction,
  uncompleteTaskAction,
} from "@/server/actions/tasks";
import { cn, formatDate } from "@/lib/utils";

export type FollowUpRowData = {
  id: string;
  title: string;
  dueAt: Date | string;
  completedAt: Date | string | null;
  contact: { id: string; name: string } | null;
};

export function FollowUpRow({ task }: { task: FollowUpRowData }) {
  const [isPending, startTransition] = useTransition();
  const overdue = !task.completedAt && new Date(task.dueAt) < new Date();
  const done = !!task.completedAt;

  function toggleComplete() {
    startTransition(async () => {
      if (done) {
        await uncompleteTaskAction(task.id);
        toast.success("Task reopened");
      } else {
        await completeTaskAction(task.id);
        toast.success("Done");
      }
    });
  }

  function snoozeOne() {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    startTransition(async () => {
      await snoozeTaskAction(task.id, next.toISOString());
      toast.success("Snoozed to tomorrow");
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteTaskAction(task.id);
    });
  }

  return (
    <li
      className={cn(
        "rounded-2xl border bg-white px-4 py-3 flex items-center gap-3 transition-colors",
        done
          ? "border-line/60 opacity-60"
          : overdue
            ? "border-red-100 bg-red-50/40"
            : "border-line"
      )}
    >
      <button
        onClick={toggleComplete}
        disabled={isPending}
        className={cn(
          "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0",
          done
            ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600"
            : "border-line hover:border-navy"
        )}
        aria-label={done ? "Reopen task" : "Complete task"}
        title={done ? "Click to reopen" : "Click to complete"}
      >
        {done && <Check className="h-3 w-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", done ? "line-through text-muted-foreground" : "text-ink")}>
          {task.title}
        </p>
        <div className="mt-0.5 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em]">
          {task.contact ? (
            <Link
              href={`/contacts/${task.contact.id}`}
              className="text-sand-700 hover:text-navy transition-colors"
            >
              {task.contact.name}
            </Link>
          ) : (
            <span className="text-muted-foreground">Unlinked</span>
          )}
          <span className={cn(overdue ? "text-red-700" : "text-muted-foreground")}>
            {formatDate(task.dueAt)}
            {overdue && " · Overdue"}
          </span>
        </div>
      </div>

      {!done && (
        <button
          onClick={snoozeOne}
          disabled={isPending}
          className="text-muted-foreground hover:text-navy transition-colors"
          title="Snooze 1 day"
        >
          <Clock className="h-3.5 w-3.5" />
        </button>
      )}
      {task.contact && (
        <Link
          href={`/contacts/${task.contact.id}`}
          className="text-muted-foreground hover:text-navy transition-colors"
          aria-label="Open contact"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      )}
      <button
        onClick={remove}
        disabled={isPending}
        className="text-muted-foreground hover:text-red-600 transition-colors"
        aria-label="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
