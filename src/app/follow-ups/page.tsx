import { CalendarClock } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { FollowUpRow, type FollowUpRowData } from "@/components/crm/follow-up-row";
import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const { agencyId } = await requireAgency();

  const tasks = await prisma.task.findMany({
    where: {
      contact: { agencyId, deletedAt: null },
    },
    include: { contact: { select: { id: true, name: true } } },
    orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }],
  });

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const overdue: FollowUpRowData[] = [];
  const today: FollowUpRowData[] = [];
  const thisWeek: FollowUpRowData[] = [];
  const later: FollowUpRowData[] = [];
  const completed: FollowUpRowData[] = [];

  for (const t of tasks) {
    const data: FollowUpRowData = {
      id: t.id,
      title: t.title,
      dueAt: t.dueAt,
      completedAt: t.completedAt,
      contact: t.contact ? { id: t.contact.id, name: t.contact.name } : null,
    };
    if (t.completedAt) {
      completed.push(data);
      continue;
    }
    const due = new Date(t.dueAt);
    if (due < startOfToday) overdue.push(data);
    else if (due < endOfToday) today.push(data);
    else if (due < endOfWeek) thisWeek.push(data);
    else later.push(data);
  }

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-6 mb-7">
        <div>
          <p className="tc-eyebrow gold">Today's plate</p>
          <h1 className="tc-page-title mt-2.5">Follow-ups</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {overdue.length > 0 && (
              <>
                <span className="text-red-700 font-medium">
                  {overdue.length} overdue
                </span>
                {" · "}
              </>
            )}
            {today.length} due today · {thisWeek.length} this week
          </p>
        </div>
      </header>

      <div className="space-y-10">
        {overdue.length > 0 && (
          <Section title="Overdue" tone="danger" tasks={overdue} />
        )}
        <Section title="Today" tasks={today} />
        <Section title="This week" tasks={thisWeek} />
        {later.length > 0 && <Section title="Later" tasks={later} muted />}
        {completed.length > 0 && (
          <Section
            title="Completed"
            tasks={completed.slice(0, 10)}
            muted
          />
        )}
      </div>

      {tasks.length === 0 && (
        <div className="rounded-3xl border border-dashed border-line bg-white/60 p-16 text-center">
          <CalendarClock className="h-6 w-6 mx-auto text-muted-foreground mb-3" />
          <p className="font-display text-2xl text-navy">Nothing scheduled</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Add a follow-up from any contact's Tasks tab.
          </p>
        </div>
      )}
    </PageShell>
  );
}

function Section({
  title,
  tasks,
  tone,
  muted,
}: {
  title: string;
  tasks: FollowUpRowData[];
  tone?: "danger";
  muted?: boolean;
}) {
  // Hide empty sections entirely — the page-level empty state covers zero tasks.
  if (tasks.length === 0) return null;
  return (
    <section>
      <h2
        className={`text-xs uppercase tracking-[0.25em] mb-3 ${
          tone === "danger"
            ? "text-red-700"
            : muted
              ? "text-muted-foreground"
              : "text-sand-700"
        }`}
      >
        {title} <span className="ml-1 opacity-70">{tasks.length}</span>
      </h2>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <FollowUpRow key={t.id} task={t} />
        ))}
      </ul>
    </section>
  );
}
