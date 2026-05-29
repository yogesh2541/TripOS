import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Lightbulb } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import {
  articleBySlug,
  articlesInCategory,
  categoryById,
} from "@/lib/help-content";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { slug: string } }) {
  const a = articleBySlug(params.slug);
  return { title: a ? `${a.title} · Help · TripCraft` : "Help · TripCraft" };
}

export default function HelpArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  const article = articleBySlug(params.slug);
  if (!article) notFound();

  const category = categoryById(article.categoryId);
  const related = articlesInCategory(article.categoryId).filter(
    (a) => a.slug !== article.slug
  );

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/help" className="hover:text-ink transition-colors">
            Help
          </Link>
          {category && (
            <>
              <span>/</span>
              <span className="text-ink/70">{category.title}</span>
            </>
          )}
        </div>

        <article>
          <h1 className="font-display text-4xl text-ink leading-tight">
            {article.title}
          </h1>
          <p className="mt-3 text-base text-ink/75 leading-relaxed">
            {article.summary}
          </p>

          <ol className="mt-8 space-y-5">
            {article.steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-inkwash text-[var(--on-dark)] text-xs font-medium tabular-nums">
                  {i + 1}
                </span>
                <div className="pt-0.5">
                  {step.heading && (
                    <p className="font-medium text-ink">{step.heading}</p>
                  )}
                  <p className="mt-0.5 text-sm text-ink/80 leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {article.tip && (
            <div className="mt-8 rounded-lg border border-[var(--gold-line)] bg-gold-soft p-4 flex items-start gap-3">
              <Lightbulb className="h-4 w-4 text-gold-deep mt-0.5 shrink-0" />
              <p className="text-sm text-ink leading-relaxed">
                {article.tip}
              </p>
            </div>
          )}
        </article>

        {related.length > 0 && (
          <section className="mt-12 pt-8 border-t border-line">
            <p className="text-[10px] uppercase tracking-[0.22em] text-gold-deep mb-3">
              More in {category?.title}
            </p>
            <ul className="space-y-1.5">
              {related.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/help/${a.slug}`}
                    className="group flex items-center justify-between gap-2 text-sm text-ink/80 hover:text-ink transition-colors"
                  >
                    <span>{a.title}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-10">
          <Link
            href="/help"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Help
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
