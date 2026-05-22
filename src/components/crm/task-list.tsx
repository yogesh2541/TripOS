"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  completeTaskAction,
  createTaskAction,
  deleteTaskAction,
  uncompleteTaskAction,
} from "@/server/actions/tasks";
import { cn, formatDate } from "@/lib/utils";

export function TaskList({
  contactId,
  tasks,
}: {
  contactId: string;
  tasks: Task[];
}) {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState<string>(() =>
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [isPending, startTransition] = useTransition();

  function add() {
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      try {
        await createTaskAction({ contactId, title: t, dueAt });
        setTitle("");
        toast.success("Task added");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Couldn't add task";
        toast.error(msg);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-white p-4 grid grid-cols-[1fr_160px_auto] gap-2">
        <Input
          placeholder="Follow up about pricing"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
        <Button
          size="sm"
          onClick={add}
          disabled={isPending || title.trim().length === 0}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CalendarPlus className="h-3.5 w-3.5" />
          )}
          Add
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-10 text-center text-sm text-muted-foreground">
          No tasks yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
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
        toast.success("Task completed");
      }
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
          "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
          done
            ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600"
            : "border-line hover:border-navy"
        )}
        aria-label={done ? "Reopen task" : "Complete task"}
        title={done ? "Click to reopen" : "Click to complete"}
      >
        {done && <Check className="h-3 w-3" />}
      </button>
      <div className="flex-1">
        <p
          className={cn(
            "text-sm",
            done ? "line-through text-muted-foreground" : "text-ink"
          )}
        >
          {task.title}
        </p>
        <p
          className={cn(
            "text-[10px] uppercase tracking-[0.18em] mt-0.5",
            overdue ? "text-red-700" : "text-muted-foreground"
          )}
        >
          Due {formatDate(task.dueAt)}
          {overdue && " · Overdue"}
        </p>
      </div>
      <button
        onClick={remove}
        disabled={isPending}
        className="text-muted-foreground hover:text-red-600 transition-colors"
        aria-label="Delete task"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
