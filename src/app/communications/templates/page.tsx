import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TemplateEditor } from "@/components/whatsapp/template-editor";
import { TEMPLATE_CATEGORY_LABEL } from "@/lib/whatsapp/templates";
import { prisma, getOrCreateDemoUser } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CommsTemplatesPage() {
  const user = await getOrCreateDemoUser();
  const templates = await prisma.whatsappTemplate.findMany({
    where: { userId: user.id },
    orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <Link
            href="/communications"
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-navy inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> Communications
          </Link>
          <h1 className="font-display text-4xl text-navy tracking-tight mt-2">
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
              className="rounded-2xl border border-line bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg text-navy">{t.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
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
              <pre className="mt-3 rounded-xl border border-line bg-ivory px-3.5 py-2.5 text-[12px] leading-relaxed text-ink whitespace-pre-wrap font-sans">
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
