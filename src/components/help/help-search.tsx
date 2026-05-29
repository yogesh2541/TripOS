"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

export type HelpSearchItem = {
  slug: string;
  title: string;
  summary: string;
  categoryTitle: string;
};

export function HelpSearch({ articles }: { articles: HelpSearchItem[] }) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return articles
      .filter((a) =>
        `${a.title} ${a.summary} ${a.categoryTitle}`
          .toLowerCase()
          .includes(needle)
      )
      .slice(0, 8);
  }, [articles, q]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search help — e.g. payment link, passport, invoice…"
          className="w-full h-12 rounded-[10px] border border-line bg-paper pl-11 pr-4 text-sm text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-line)] focus-visible:border-[var(--gold-line)] shadow-soft"
        />
      </div>

      {q.trim() && (
        <div className="mt-3 rounded-lg border border-line bg-paper shadow-pop overflow-hidden">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No guides match &ldquo;{q}&rdquo;. Try a different term or contact
              support below.
            </p>
          ) : (
            <ul>
              {results.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/help/${a.slug}`}
                    className="flex items-start justify-between gap-3 px-4 py-3 border-b border-line/60 last:border-0 hover:bg-paper-2 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">
                        {a.title}
                      </span>
                      <span className="block text-xs text-muted truncate">
                        {a.categoryTitle} · {a.summary}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
