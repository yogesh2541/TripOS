import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { ProposalBrandingForm } from "@/components/settings/proposal-branding-form";
import { requireAgency } from "@/lib/session";
import { getAgencySettings } from "@/server/services/agency-settings";
import { PROPOSAL_THEMES, COVER_STYLES } from "@/lib/proposal-branding";

export const dynamic = "force-dynamic";

type Theme = (typeof PROPOSAL_THEMES)[number];
type Cover = (typeof COVER_STYLES)[number];

function isTheme(v: string | null | undefined): v is Theme {
  return !!v && (PROPOSAL_THEMES as readonly string[]).includes(v);
}
function isCover(v: string | null | undefined): v is Cover {
  return !!v && (COVER_STYLES as readonly string[]).includes(v);
}

export default async function ProposalBrandingPage() {
  const { user } = await requireAgency();
  const canEdit = user.activeAgencyRole === "OWNER";
  const settings = await getAgencySettings();

  return (
    <PageShell>
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
      </div>

      <header className="mb-8">
        <p className="tc-eyebrow gold">Settings</p>
        <h1 className="tc-page-title mt-2.5">Proposal branding</h1>
        <p className="tc-page-sub max-w-2xl">
          Choose a template, set your accent colour, and decide which sections
          customers see. Your logo is stamped throughout — on the hero, every
          major section, and the closing — so your brand is what they remember.
        </p>
      </header>

      {!settings ? (
        <div className="rounded-lg border border-[var(--gold-line)] bg-gold-soft/40 p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 mt-0.5 text-gold-deep shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-ink">
                Set up your agency identity first
              </p>
              <p className="mt-1 text-sm text-muted">
                Add your legal name and logo under Settings → Agency. Once
                that's saved, you can come back here to customise how
                proposals look to your clients.
              </p>
              <div className="mt-4">
                <Link href="/settings/agency">
                  <Button>Open agency settings</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ProposalBrandingForm
          agencyName={settings.tradeName || settings.legalName}
          logoUrl={settings.logoUrl}
          canEdit={canEdit}
          initial={{
            theme: isTheme(settings.proposalTheme)
              ? settings.proposalTheme
              : "classic",
            accentColor: settings.proposalAccentColor,
            coverStyle: isCover(settings.proposalCoverStyle)
              ? settings.proposalCoverStyle
              : "photo",
            showAtAGlance: settings.proposalShowAtAGlance,
            showInclusions: settings.proposalShowInclusions,
            showTerms: settings.proposalShowTerms,
            signatureNote: settings.proposalSignatureNote,
            repeatLogo: settings.proposalRepeatLogo,
          }}
        />
      )}
    </PageShell>
  );
}
