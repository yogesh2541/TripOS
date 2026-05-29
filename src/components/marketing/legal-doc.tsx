import { MarketingShell } from "@/components/marketing/marketing-shell";

// Shared shell for the legal pages — consistent typography for prose-style
// documents rendered inside the public marketing chrome.
export function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 md:px-10 py-16">
        <p className="tc-eyebrow gold">Legal</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl text-ink leading-tight">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted">
          Last updated {updated}
        </p>
        <div
          className={
            "mt-10 space-y-3 text-sm text-ink/80 leading-relaxed " +
            "[&_h2]:font-display [&_h2]:text-xl [&_h2]:text-ink [&_h2]:mt-9 [&_h2]:mb-2 " +
            "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 " +
            "[&_a]:text-ink [&_a]:underline"
          }
        >
          {children}
        </div>
      </article>
    </MarketingShell>
  );
}
