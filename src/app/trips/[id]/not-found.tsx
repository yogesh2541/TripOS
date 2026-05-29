import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";

export default function TripNotFound() {
  return (
    <PageShell>
      <div className="text-center py-24">
        <p className="tc-eyebrow gold">404</p>
        <h1 className="mt-4 font-display text-5xl text-ink">
          Trip not found
        </h1>
        <p className="mt-3 text-muted">
          It may have been removed or never existed.
        </p>
        <div className="mt-8">
          <Link href="/">
            <Button>Back to dashboard</Button>
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
