"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/server/helpers/log-activity";

const TASK_TYPES = [
  "HOTEL_CONFIRMATION",
  "DRIVER_ASSIGNMENT",
  "PAYMENT_COLLECTION",
  "VOUCHER_SENT",
  "DOCUMENT_COLLECTION",
  "INTERNAL",
  "OTHER",
] as const;

const TASK_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "BLOCKED",
] as const;

const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const createSchema = z.object({
  tripId: z.string(),
  bookingId: z.string().optional().nullable(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(TASK_TYPES).default("OTHER"),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
  dueDate: z.string().optional().nullable(),
});

export type OperationTaskInput = z.input<typeof createSchema>;

function trimOrNull(s: string | null | undefined) {
  if (s === null || s === undefined) return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}
function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createOperationTaskAction(input: OperationTaskInput) {
  const data = createSchema.parse(input);

  const trip = await prisma.trip.findFirst({
    where: { id: data.tripId, deletedAt: null },
    select: { id: true, leadId: true },
  });
  if (!trip) throw new Error("Trip not found");

  const task = await prisma.operationTask.create({
    data: {
      tripId: data.tripId,
      bookingId: data.bookingId ?? null,
      title: data.title.trim(),
      description: trimOrNull(data.description),
      type: data.type,
      priority: data.priority,
      dueDate: toDate(data.dueDate),
    },
  });

  await logActivity({
    tripId: trip.id,
    leadId: trip.leadId,
    type: "OPS_TASK_CREATED",
    title: `Ops task: ${task.title}`,
    metadata: { taskId: task.id, type: task.type },
  });

  revalidatePath(`/trips/${trip.id}`);
  return { id: task.id };
}

const updateSchema = createSchema.partial().extend({
  status: z.enum(TASK_STATUSES).optional(),
});

export async function updateOperationTaskAction(
  taskId: string,
  patch: z.infer<typeof updateSchema>
) {
  const data = updateSchema.parse(patch);
  const existing = await prisma.operationTask.findUnique({
    where: { id: taskId },
    select: { tripId: true },
  });
  if (!existing) throw new Error("Task not found");

  await prisma.operationTask.update({
    where: { id: taskId },
    data: {
      title: data.title?.trim(),
      description:
        data.description === undefined
          ? undefined
          : trimOrNull(data.description),
      type: data.type,
      priority: data.priority,
      status: data.status,
      dueDate:
        data.dueDate === undefined
          ? undefined
          : toDate(data.dueDate),
    },
  });

  revalidatePath(`/trips/${existing.tripId}`);
  return { ok: true as const };
}

export async function toggleOperationTaskAction(
  taskId: string,
  completed: boolean
) {
  const existing = await prisma.operationTask.findUnique({
    where: { id: taskId },
    include: {
      trip: { select: { id: true, leadId: true } },
    },
  });
  if (!existing) throw new Error("Task not found");

  await prisma.operationTask.update({
    where: { id: taskId },
    data: {
      status: completed ? "COMPLETED" : "PENDING",
      completedAt: completed ? new Date() : null,
    },
  });

  if (completed) {
    await logActivity({
      tripId: existing.trip.id,
      leadId: existing.trip.leadId,
      type: "OPS_TASK_COMPLETED",
      title: `Completed: ${existing.title}`,
      metadata: { taskId: existing.id, type: existing.type },
    });
  }

  revalidatePath(`/trips/${existing.trip.id}`);
  return { ok: true as const };
}

export type DeletedOperationTaskSnapshot = {
  tripId: string;
  bookingId: string | null;
  title: string;
  description: string | null;
  type: OperationTaskInput["type"];
  priority: OperationTaskInput["priority"];
  dueDate: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
};

export async function deleteOperationTaskAction(taskId: string) {
  const existing = await prisma.operationTask.findUnique({
    where: { id: taskId },
  });
  if (!existing) throw new Error("Task not found");
  await prisma.operationTask.delete({ where: { id: taskId } });
  revalidatePath(`/trips/${existing.tripId}`);

  const snapshot: DeletedOperationTaskSnapshot = {
    tripId: existing.tripId,
    bookingId: existing.bookingId,
    title: existing.title,
    description: existing.description,
    type: existing.type,
    priority: existing.priority,
    dueDate: existing.dueDate?.toISOString() ?? null,
    status: existing.status,
  };
  return { ok: true as const, snapshot };
}

export async function restoreOperationTaskAction(
  snapshot: DeletedOperationTaskSnapshot
) {
  const restored = await prisma.operationTask.create({
    data: {
      tripId: snapshot.tripId,
      bookingId: snapshot.bookingId,
      title: snapshot.title,
      description: snapshot.description,
      type: snapshot.type,
      priority: snapshot.priority,
      dueDate: snapshot.dueDate ? new Date(snapshot.dueDate) : null,
      status: snapshot.status,
    },
  });
  revalidatePath(`/trips/${snapshot.tripId}`);
  return { id: restored.id };
}
