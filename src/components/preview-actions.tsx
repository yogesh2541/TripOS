"use client";

import { useState } from "react";
import { Check, Download, Link2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SendProposalDialog } from "@/components/quotes/send-proposal-dialog";

export function PreviewActions({
  tripId,
  quoteId,
  recipientPhone,
  recipientName,
  recipientEmail,
  destination,
  agencyName,
  total,
  perPerson,
  version,
  dateRange,
  validityDays,
  preparedAt,
  shareToken,
}: {
  tripId: string;
  quoteId?: string | null;
  recipientPhone?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  destination?: string | null;
  agencyName?: string;
  total?: number | null;
  perPerson?: number | null;
  version?: number | null;
  dateRange?: string | null;
  validityDays?: number;
  preparedAt?: string | null;
  shareToken?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const url = `${window.location.origin}/trips/${tripId}/preview`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={copyLink}>
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Link2 className="h-3.5 w-3.5" />
        )}
        {copied ? "Link copied" : "Share link"}
      </Button>
      {quoteId ? (
        <a
          href={`/api/proposals/${quoteId}/pdf`}
          target="_blank"
          rel="noopener"
        >
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" />
            PDF
          </Button>
        </a>
      ) : null}
      {quoteId ? (
        <SendProposalDialog
          tripId={tripId}
          quoteId={quoteId}
          recipientName={recipientName}
          recipientPhone={recipientPhone}
          recipientEmail={recipientEmail}
          destination={destination}
          agencyName={agencyName}
          total={total}
          perPerson={perPerson}
          version={version}
          dateRange={dateRange}
          validityDays={validityDays}
          preparedAt={preparedAt}
          shareToken={shareToken}
          trigger={
            <Button variant="accent" size="sm">
              <Send className="h-3.5 w-3.5" />
              Send proposal
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
