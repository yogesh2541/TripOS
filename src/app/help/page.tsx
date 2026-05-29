import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Compass,
  CreditCard,
  FileText,
  LifeBuoy,
  MessageCircle,
  Rocket,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { HelpSearch } from "@/components/help/help-search";
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  HELP_FAQS,
  articlesInCategory,
  categoryById,
  type HelpIconKey,
} from "@/lib/help-content";

export const dynamic = "force-dynamic";
export const metadata = { title: "Help · TripCraft" };

const ICONS: Record<HelpIconKey, LucideIcon> = {
  rocket: Rocket,
  users: Users,
  compass: Compass,
  fileText: FileText,
  wallet: Wallet,
  messageCircle: MessageCircle,
  building: Building2,
  barChart: BarChart3,
  creditCard: CreditCard,
};

export default function HelpPage() {
  const searchItems = HELP_ARTICLES.map((a) => ({
    slug: a.slug,
    title: a.title,
    summary: a.summary,
    categoryTitle: categoryById(a.categoryId)?.title ?? "",
  }));

  return (
    <PageShell>
      <header className="mb-8 text-center max-w-2xl mx-auto">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] bg-inkwash text-[var(--on-dark)] mx-auto">
          <LifeBuoy className="h-5 w-5" />
        </span>
        <h1 className="mt-4 font-display text-4xl md:text-5xl text-ink leading-tight">
          How can we help?
        </h1>
        <p className="mt-2 text-sm text-muted">
          Guides and fixes for everything in TripCraft. Search, or browse by
          topic.
        </p>
        <div className="mt-6 text-left">
          <HelpSearch articles={searchItems} />
        </div>
      </header>

      {/* Browse by category */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HELP_CATEGORIES.map((cat) => {
          const Icon = ICONS[cat.icon];
          const articles = articlesInCategory(cat.id);
          return (
            <div
              key={cat.id}
              className="rounded-lg border border-line bg-paper p-5 shadow-soft"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-paper-2 border border-line text-gold-deep">
                  <Icon className="h-4 w-4" />
                </span>
                <h2 className="font-display text-lg text-ink">{cat.title}</h2>
              </div>
              <p className="mt-2 text-xs text-muted">
                {cat.description}
              </p>
              <ul className="mt-4 space-y-1.5">
                {articles.map((a) => (
                  <li key={a.slug}>
                    <Link
                      href={`/help/${a.slug}`}
                      className="group flex items-center justify-between gap-2 text-sm text-ink/80 hover:text-ink transition-colors"
                    >
                      <span className="truncate">{a.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {/* Troubleshooting */}
      <section className="mt-12">
        <h2 className="font-display text-2xl text-ink mb-5">
          Stuck? Common fixes
        </h2>
        <div className="space-y-2.5">
          {HELP_FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-lg border border-line bg-paper px-5 py-4 [&_summary]:cursor-pointer"
            >
              <summary className="flex items-center justify-between gap-3 text-sm font-medium text-ink list-none">
                {f.q}
                <span className="text-muted transition-transform group-open:rotate-45 text-lg leading-none">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-ink/75 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* New here? */}
      <section className="mt-12 rounded-lg border border-[var(--gold-line)] bg-gold-soft p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-paper border border-line text-gold-deep">
            <Rocket className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">New to TripCraft?</p>
            <p className="text-xs text-muted">
              Replay the quick welcome walkthrough.
            </p>
          </div>
        </div>
        <Link
          href="/?tour=1"
          className="inline-flex items-center gap-2 rounded-[8px] border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:border-line-2 transition-colors"
        >
          Replay the tour
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Contact */}
      <section className="mt-6 rounded-lg border border-line bg-inkwash text-[var(--on-dark)] p-8 text-center">
        <h2 className="font-display text-2xl">Still need a hand?</h2>
        <p className="mt-2 text-sm text-[var(--on-dark)]/75 max-w-md mx-auto">
          Can&apos;t find what you&apos;re looking for? Our team is one message
          away.
        </p>
        <a
          href="mailto:support@tripcraft.app"
          className="mt-5 inline-flex items-center gap-2 rounded-[8px] bg-paper px-5 py-2.5 text-sm font-medium text-ink hover:bg-paper-2 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          Email support
        </a>
      </section>
    </PageShell>
  );
}
