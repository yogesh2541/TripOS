import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TemplateEditor } from "@/components/whatsapp/template-editor";
import { TEMPLATE_CATEGORY_LABEL } from "@/lib/whatsapp/templates";
import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CommsTemplatesPage() {
  const { agencyId } = await requireAgency();
  const templates = await prisma.whatsappTemplate.findMany({
    where: { agencyId },
    orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <Link
            href="/communications"
            className="text-xs uppercase tracking-[0.18em] text-muted hover:text-ink inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> Communications
          </Link>
          <h1 className="mt-2 tc-page-title">
            Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Author once, reuse everywhere. Register the same{" "}
            <em>template id</em> on Meta to graduate from text to template
            sends.
          </p>
        </div>
        <TemplateEditor />
      </header>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          body="Create your first one — proposal, invoice, reminder, follow-up — and TripCraft will reuse it across the workflow."
          action={<TemplateEditor />}
          variant="card"
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-line bg-paper p-5 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg text-ink">{t.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted mt-0.5 font-mono">
                    {t.templateId} · {t.language.toUpperCase()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={t.isActive ? "success" : "muted"}>
                    {t.isActive ? "Active" : "Paused"}
                  </Badge>
                  <Badge variant="outline">
                    {TEMPLATE_CATEGORY_LABEL[t.category]}
                  </Badge>
                </div>
              </div>
              <pre className="mt-3 rounded-[8px] border border-line bg-paper-2 px-3.5 py-2.5 text-[12px] leading-relaxed text-ink whitespace-pre-wrap font-sans">
                {t.bodyPreview}
              </pre>
              <div className="mt-3 flex items-center justify-end">
                <TemplateEditor
                  trigger={
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  }
                  initial={{
                    id: t.id,
                    name: t.name,
                    templateId: t.templateId,
                    category: t.category,
                    language: t.language,
                    bodyPreview: t.bodyPreview,
                    variables: (t.variables as unknown as Array<{
                      key: string;
                      label: string;
                      example?: string;
                    }>) ?? [],
                    isActive: t.isActive,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
